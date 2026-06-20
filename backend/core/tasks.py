from celery import shared_task
from django.utils import timezone
import json
import logging
import random

logger = logging.getLogger(__name__)


@shared_task
def process_and_send_email(name, email, company, requirement, sender_profile_json="{}", lead_id=None):
    from core.services.email_service import send_ai_email
    try:
        result = send_ai_email(
            name=name, email=email, company=company,
            requirement=requirement, sender_profile_json=sender_profile_json,
            is_followup=False, lead_id=lead_id
        )
        return result
    except Exception as e:
        logger.error(f"Email send failed for {email}: {e}")
        raise


@shared_task
def send_smart_followup(lead_id, followup_type, sender_profile_json="{}", attempt=1):
    from core.models import Lead, EmailLog
    from core.services.email_service import send_ai_email_with_context

    try:
        lead = Lead.objects.get(id=lead_id)
    except Lead.DoesNotExist:
        return

    if lead.replied:
        return

    last_log = EmailLog.objects.filter(lead=lead, status="sent").order_by("-sent_at").first()
    if not last_log or last_log.replied:
        return

    previous_context = {
        "subject": last_log.subject,
        "message": last_log.message,
        "was_opened": last_log.opened,
        "was_clicked": last_log.clicked,
        "followup_type": followup_type,
        "attempt": attempt,
        "sent_at": str(last_log.sent_at),
    }

    send_ai_email_with_context(
        name=lead.name, email=lead.email, company=lead.company,
        requirement=lead.requirement, sender_profile_json=sender_profile_json,
        previous_context=previous_context, attempt=attempt,
    )


@shared_task
def check_and_schedule_followups():
    """
    Runs every 5 min via Celery Beat.
    Test mode: 5 min threshold
    Production: selected days threshold
    """
    from core.models import EmailLog, Lead, Campaign, FollowUpSettings

    settings_obj, _ = FollowUpSettings.objects.get_or_create(pk=1)
    if not settings_obj.enabled:
        return {"skipped": "followups disabled"}

    max_attempts = settings_obj.max_attempts
    followup_days = [int(d.strip()) for d in settings_obj.followup_days.split(",") if d.strip()]
    test_mode = settings_obj.test_mode

    sender_profile = {}
    try:
        camp = Campaign.objects.get(name="__sender_profile__")
        sender_profile = json.loads(camp.status) if camp.status != "draft" else {}
    except Exception:
        pass
    sender_profile_json = json.dumps(sender_profile)

    now = timezone.now()
    scheduled = 0

    logs = EmailLog.objects.filter(
        status="sent",
        replied=False,
        followup_sent=False,
    ).select_related("lead")

    for log in logs:
        lead = log.lead
        if lead.replied:
            continue

        attempts_sent = EmailLog.objects.filter(
            lead=lead, followup_sent=True, status="sent"
        ).count()

        if attempts_sent >= max_attempts:
            continue

        next_attempt = attempts_sent + 1
        if next_attempt > len(followup_days):
            continue

        days_threshold = followup_days[next_attempt - 1]
        hours_since = (now - log.sent_at).total_seconds() / 3600

        if test_mode:
            threshold_hours = 5 / 60
            hot_threshold = 2 / 60
        else:
            threshold_hours = days_threshold * 24
            hot_threshold = 1.0

        if log.clicked and hours_since >= hot_threshold:
            send_smart_followup.apply_async(
                args=[lead.id, "opened_clicked", sender_profile_json, next_attempt],
                countdown=0
            )
            log.followup_sent = True
            log.save()
            scheduled += 1
            logger.info(f"Hot followup → {lead.email}")

        elif log.opened and not log.clicked and hours_since >= threshold_hours:
            send_smart_followup.apply_async(
                args=[lead.id, "no_response", sender_profile_json, next_attempt],
                countdown=0
            )
            log.followup_sent = True
            log.save()
            scheduled += 1
            logger.info(f"Warm followup → {lead.email}")

        elif not log.opened and hours_since >= threshold_hours:
            send_smart_followup.apply_async(
                args=[lead.id, "no_open", sender_profile_json, next_attempt],
                countdown=0
            )
            log.followup_sent = True
            log.save()
            scheduled += 1
            logger.info(f"Cold followup → {lead.email}")

    logger.info(f"Scheduled {scheduled} followups")
    return {"scheduled": scheduled}


@shared_task
def check_and_auto_reply():
    """
    Runs every 5 min via Celery Beat.
    FIXED: Reply always marked regardless of auto_reply_enabled setting
    """
    from core.models import FollowUpSettings, EmailLog, Lead, Campaign
    from core.services.gmail_reader import fetch_replies_imap
    from core.services.email_service import send_auto_reply

    settings_obj, _ = FollowUpSettings.objects.get_or_create(pk=1)
    replies = fetch_replies_imap()
    processed = 0

    for reply in replies:
        sender_email = reply["from_email"]
        reply_body = reply["body"]
        subject = reply["subject"]

        leads = Lead.objects.filter(email__iexact=sender_email, replied=False)
        if not leads.exists():
            continue

        if not is_business_reply(reply_body, subject):
            logger.info(f"Ignored non-business email from {sender_email}")
            continue

        for lead in leads:
            # ✅ ALWAYS mark replied — independent of auto_reply_enabled
            lead.replied = True
            lead.replied_at = timezone.now()
            lead.save()
            EmailLog.objects.filter(lead=lead).update(replied=True)
            logger.info(f"Marked replied: {lead.email}")

            # ✅ Send auto-reply ONLY if enabled
            if settings_obj.auto_reply_enabled:
                try:
                    camp = Campaign.objects.get(name="__sender_profile__")
                    sender_profile = json.loads(camp.status) if camp.status != "draft" else {}
                except Campaign.DoesNotExist:
                    sender_profile = {}

                original_log = EmailLog.objects.filter(
                    lead=lead, followup_sent=False, status="sent"
                ).order_by("-sent_at").first()
                original_email = original_log.message if original_log else ""

                try:
                    send_auto_reply(
                        lead=lead, reply_text=reply_body,
                        original_email=original_email,
                        sender_profile_json=json.dumps(sender_profile),
                    )
                    EmailLog.objects.filter(lead=lead, replied=True).update(auto_replied=True)
                    logger.info(f"Auto-reply sent to {lead.email}")
                except Exception as e:
                    logger.error(f"Auto-reply failed for {lead.email}: {e}")

            processed += 1

    return {"processed": processed}


def is_business_reply(body: str, subject: str) -> bool:
    body_lower = (body or "").lower()
    subject_lower = (subject or "").lower()

    ignore_patterns = [
        "unsubscribe", "no-reply", "noreply", "notification", "donotreply",
        "do not reply", "auto-generated", "automatic reply", "out of office",
        "delivery failed", "mailer-daemon", "postmaster",
        "discount", "offer", "sale", "% off", "deal", "coupon",
        "newsletter", "marketing", "advertisement", "sponsored",
        "verify your", "confirm your", "click here to",
        "linkedin", "twitter", "facebook", "instagram",
    ]

    for pattern in ignore_patterns:
        if pattern in body_lower or pattern in subject_lower:
            return False

    # ✅ Strip quoted text — only check actual reply
    actual_reply = body
    for separator in ["\r\nOn ", "\nOn ", "On "]:
        if separator in body:
            actual_reply = body.split(separator)[0].strip()
            break

    # ✅ Accept if 2+ chars
    if len(actual_reply.strip()) < 2:
        return False

    return True