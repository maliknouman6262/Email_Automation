from celery import shared_task
from django.utils import timezone
import json
import logging
import random

logger = logging.getLogger(__name__)


@shared_task
def process_and_send_email(name, email, company, requirement, sender_profile_json="{}"):
    from core.services.email_service import send_ai_email
    return send_ai_email(
        name=name, email=email, company=company,
        requirement=requirement, sender_profile_json=sender_profile_json,
        is_followup=False
    )


@shared_task
def send_smart_followup(lead_id, followup_type, sender_profile_json="{}", attempt=1):
    """Send context-aware followup based on engagement state."""
    from core.models import Lead, EmailLog
    from core.services.email_service import send_ai_email_with_context

    try:
        lead = Lead.objects.get(id=lead_id)
    except Lead.DoesNotExist:
        return

    # Skip if lead already replied
    if lead.replied:
        logger.info(f"Lead {lead.email} already replied, skipping followup attempt {attempt}")
        return

    # Get last email log
    last_log = EmailLog.objects.filter(
        lead=lead, status="sent"
    ).order_by("-sent_at").first()

    if not last_log:
        return

    if last_log.replied:
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
        name=lead.name,
        email=lead.email,
        company=lead.company,
        requirement=lead.requirement,
        sender_profile_json=sender_profile_json,
        previous_context=previous_context,
        attempt=attempt,
    )


@shared_task
def check_and_schedule_followups():
    """
    Runs every 30 min via Celery Beat.
    Checks FollowUpSettings and schedules smart followups based on engagement.
    """
    from core.models import EmailLog, Lead, Campaign, FollowUpSettings

    settings_obj, _ = FollowUpSettings.objects.get_or_create(pk=1)
    if not settings_obj.enabled:
        return {"skipped": "followups disabled"}

    max_attempts = settings_obj.max_attempts
    followup_days = [int(d.strip()) for d in settings_obj.followup_days.split(",") if d.strip()]

    # Load sender profile
    sender_profile = {}
    try:
        camp = Campaign.objects.get(name="__sender_profile__")
        sender_profile = json.loads(camp.status) if camp.status != "draft" else {}
    except Campaign.DoesNotExist:
        pass
    sender_profile_json = json.dumps(sender_profile)

    now = timezone.now()
    scheduled = 0

    # Get all sent emails where lead hasn't replied and followup attempts < max
    logs = EmailLog.objects.filter(
        status="sent",
        replied=False,
    ).select_related("lead")

    for log in logs:
        lead = log.lead
        if lead.replied:
            continue

        # Count how many followups already sent
        attempts_sent = EmailLog.objects.filter(
            lead=lead,
            followup_sent=True,
            status="sent"
        ).count()

        if attempts_sent >= max_attempts:
            continue

        next_attempt = attempts_sent + 1
        if next_attempt > len(followup_days):
            continue

        days_threshold = followup_days[next_attempt - 1]
        hours_since = (now - log.sent_at).total_seconds() / 3600

        # Hot followup: opened+clicked → 1-2 hours
        if log.clicked and not log.followup_sent:
            if hours_since >= 1:
                delay = random.randint(0, 30 * 60)
                send_smart_followup.apply_async(
                    args=[lead.id, "opened_no_reply", sender_profile_json, next_attempt],
                    countdown=delay
                )
                log.followup_sent = True
                log.save()
                scheduled += 1

        # Cold/warm followup based on days threshold
        elif not log.followup_sent and hours_since >= (days_threshold * 24):
            ftype = "no_open" if not log.opened else "no_response"
            delay = random.randint(0, 2 * 3600)  # spread within 2 hrs
            send_smart_followup.apply_async(
                args=[lead.id, ftype, sender_profile_json, next_attempt],
                countdown=delay
            )
            log.followup_sent = True
            log.save()
            scheduled += 1

    logger.info(f"Scheduled {scheduled} followups")
    return {"scheduled": scheduled}


@shared_task
def check_and_auto_reply():
    """
    Runs every 15 min via Celery Beat.
    Reads Gmail inbox via IMAP, detects replies, auto-replies if enabled.
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

        # Find lead by email
        lead = Lead.objects.filter(email__iexact=sender_email).first()
        if not lead:
            continue

        # Check if it's a real business reply (not spam/ad/notification)
        if not is_business_reply(reply_body, subject):
            logger.info(f"Ignored non-business email from {sender_email}")
            continue

        # Mark as replied
        lead.replied = True
        lead.replied_at = timezone.now()
        lead.save()

        # Mark EmailLog as replied
        EmailLog.objects.filter(lead=lead).update(replied=True)

        # Auto-reply if enabled
        if settings_obj.auto_reply_enabled:
            # Load sender profile
            try:
                camp = Campaign.objects.get(name="__sender_profile__")
                sender_profile = json.loads(camp.status) if camp.status != "draft" else {}
            except Campaign.DoesNotExist:
                sender_profile = {}

            # Get original email context
            original_log = EmailLog.objects.filter(lead=lead, followup_sent=False).order_by("-sent_at").first()
            original_email = original_log.message if original_log else ""

            send_auto_reply(
                lead=lead,
                reply_text=reply_body,
                original_email=original_email,
                sender_profile_json=json.dumps(sender_profile),
            )

            EmailLog.objects.filter(lead=lead, replied=True).update(auto_replied=True)

        processed += 1

    return {"processed": processed}


def is_business_reply(body: str, subject: str) -> bool:
    """Determine if email is a genuine business reply vs spam/ad/notification."""
    body_lower = (body or "").lower()
    subject_lower = (subject or "").lower()

    # Ignore patterns
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

    # Must have some meaningful content
    if len(body.strip()) < 20:
        return False

    return True