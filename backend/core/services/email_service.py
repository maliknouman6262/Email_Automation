import uuid
from django.conf import settings
from django.core.mail import EmailMessage
from django.utils import timezone
from core.ai.email_generator import generate_email
from core.models import Lead, EmailLog
import re
import logging

logger = logging.getLogger(__name__)


def text_to_html(text: str) -> str:
    text = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    text = re.sub(r'(https?://[^\s]+)', r'<a href="\1">\1</a>', text)
    text = text.replace("\n", "<br>")
    return f"""<html><body style="font-family:Arial,sans-serif;font-size:14px;line-height:1.8;color:#333;max-width:600px;margin:0 auto;padding:24px">{text}</body></html>"""


def inject_tracking(html_body: str, tracking_id: str, base_url: str) -> str:
    pixel = f'<img src="{base_url}/api/track/open/{tracking_id}/" width="1" height="1" style="display:none;width:1px;height:1px" alt="" />'

    def wrap_link(match):
        original_url = match.group(1)
        if "track" in original_url or "unsubscribe" in original_url:
            return match.group(0)
        encoded = original_url.replace("&", "%26")
        return f'href="{base_url}/api/track/click/{tracking_id}/?url={encoded}"'

    html_body = re.sub(r'href="(https?://[^"]+)"', wrap_link, html_body)
    html_body += pixel
    return html_body


def _check_warmup_limit():
    """Returns True if we can send, False if daily limit reached."""
    from core.models import WarmupConfig
    from datetime import date

    config, _ = WarmupConfig.objects.get_or_create(pk=1)

    # Reset daily counter if new day
    today = date.today()
    if config.last_reset_date != today:
        config.emails_sent_today = 0
        config.last_reset_date = today
        config.save()

    # Always enforce 25/day limit (already warmed up account)
    DAILY_LIMIT = 25
    if config.emails_sent_today >= DAILY_LIMIT:
        raise Exception(f"Daily limit of {DAILY_LIMIT} emails reached. Will resume tomorrow.")

    return config


def _send_html_email(to_email, subject, plain_text, tracking_id):
    """Build and send HTML email with tracking."""
    base_url = getattr(settings, "SITE_BASE_URL", "http://127.0.0.1:8000")
    html_body = text_to_html(plain_text)
    html_body = inject_tracking(html_body, tracking_id, base_url)

    msg = EmailMessage(
        subject=subject,
        body=html_body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[to_email],
    )
    msg.content_subtype = "html"
    msg.extra_headers = {
        "X-Mailer": "MailFlow/1.0",
        "Precedence": "bulk",
        "X-Priority": "3",
        "List-Unsubscribe": f"<mailto:{settings.DEFAULT_FROM_EMAIL}?subject=unsubscribe>",
    }
    msg.send(fail_silently=False)


def send_ai_email(name, email, company, requirement, sender_profile_json="{}", is_followup=False):
    """Send initial email or basic followup."""
    subject = f"Following up – {company}" if is_followup else f"Proposal for {company}"
    tracking_id = str(uuid.uuid4())
    lead = Lead.objects.filter(email=email).first()
    log = None

    try:
        config = _check_warmup_limit()

        plain_text = generate_email(
            name=name,
            company=company,
            requirement=requirement,
            sender_profile_json=sender_profile_json,
            is_followup=is_followup,
        )

        if lead:
            log = EmailLog.objects.create(
                lead=lead,
                campaign=lead.campaign,
                subject=subject,
                message=plain_text,
                status="sending",
                followup_sent=is_followup,
                followup_attempt=0,
                replied=False,
                auto_replied=False,
                tracking_id=tracking_id,
            )

        _send_html_email(email, subject, plain_text, tracking_id)

        if log:
            log.status = "sent"
            log.save()

        if lead and not is_followup:
            lead.status = "sent"
            lead.save()

        # Update warmup counter
        config.emails_sent_today += 1
        config.save()

        return {"subject": subject, "status": "sent", "tracking_id": tracking_id}

    except Exception as e:
        logger.error(f"Email failed to {email}: {e}")
        if lead:
            if log:
                log.status = "failed"
                log.error_message = str(e)
                log.save()
            else:
                EmailLog.objects.create(
                    lead=lead,
                    campaign=lead.campaign,
                    subject=subject,
                    message="",
                    status="failed",
                    error_message=str(e),
                    followup_sent=is_followup,
                    tracking_id=tracking_id,
                )
        raise e


def send_ai_email_with_context(name, email, company, requirement, sender_profile_json="{}", previous_context=None):
    """
    Send smart follow-up with full context about previous email and engagement.
    """
    followup_type = previous_context.get("followup_type", "no_response") if previous_context else "no_response"

    subject_map = {
        "opened_no_reply": f"Quick follow-up – {company}",
        "no_open":         f"Did you see this? – {company}",
        "no_response":     f"Following up – {company}",
    }
    subject = subject_map.get(followup_type, f"Following up – {company}")
    tracking_id = str(uuid.uuid4())
    lead = Lead.objects.filter(email=email).first()
    log = None

    try:
        config = _check_warmup_limit()

        plain_text = generate_email(
            name=name,
            company=company,
            requirement=requirement,
            sender_profile_json=sender_profile_json,
            is_followup=True,
            previous_context=previous_context,
        )

        if lead:
            log = EmailLog.objects.create(
                lead=lead,
                campaign=lead.campaign,
                subject=subject,
                message=plain_text,
                status="sending",
                followup_sent=True,
                tracking_id=tracking_id,
            )

        _send_html_email(email, subject, plain_text, tracking_id)

        if log:
            log.status = "sent"
            log.save()

        config.emails_sent_today += 1
        config.save()

        logger.info(f"Smart followup sent to {email} [{followup_type}]")
        return {"subject": subject, "status": "sent", "followup_type": followup_type}

    except Exception as e:
        logger.error(f"Smart followup failed to {email}: {e}")
        if lead:
            if log:
                log.status = "failed"
                log.error_message = str(e)
                log.save()
            else:
                EmailLog.objects.create(
                    lead=lead,
                    campaign=lead.campaign,
                    subject=subject,
                    message="",
                    status="failed",
                    error_message=str(e),
                    followup_sent=True,
                    tracking_id=tracking_id,
                )
        raise e


def send_auto_reply(lead, reply_text, original_email, sender_profile_json="{}"):
    """Generate and send AI auto-reply to a lead's response."""
    import uuid as _uuid
    from core.models import EmailLog

    try:
        sp_raw = json.loads(sender_profile_json) if isinstance(sender_profile_json, str) else sender_profile_json
        sp = sp_raw.get("profile", sp_raw) if "profile" in sp_raw else sp_raw
        es = sp_raw.get("email_style", {})
    except Exception:
        sp = {}
        es = {}

    sender_name = sp.get("name", "")
    tone = es.get("tone", "professional")
    language = es.get("language", "english")

    prompt = f"""You are {sender_name or 'the sender'}, responding to a business lead who replied to your cold outreach email.

YOUR ORIGINAL EMAIL:
{original_email[:800]}

THEIR REPLY:
{reply_text[:600]}

INSTRUCTIONS:
- Respond naturally and professionally as {sender_name}
- This is a real conversation — be warm and helpful
- If they asked a question, answer it clearly
- If they showed interest, suggest a call/meeting
- If they said not interested, thank them politely and close gracefully
- Tone: {tone}, Language: {language}
- Keep it SHORT — 3 to 5 sentences max
- Sign off as: {sender_name}
- Output ONLY the email body, no subject line"""

    url = "https://api.deepinfra.com/v1/openai/chat/completions"
    from django.conf import settings as dj_settings
    headers = {
        "Authorization": f"Bearer {dj_settings.DEEPINFRA_API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": "meta-llama/Meta-Llama-3.1-70B-Instruct",
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.7,
        "max_tokens": 300,
    }

    import requests as req
    response = req.post(url, json=payload, headers=headers, timeout=30)
    reply_body = response.json()["choices"][0]["message"]["content"]

    subject = f"Re: Proposal for {lead.company}"
    tracking_id = str(_uuid.uuid4())

    base_url = getattr(dj_settings, "SITE_BASE_URL", "http://127.0.0.1:8000")
    html_body = text_to_html(reply_body)
    html_body = inject_tracking(html_body, tracking_id, base_url)

    from django.core.mail import EmailMessage as DjEmailMessage
    msg = DjEmailMessage(
        subject=subject,
        body=html_body,
        from_email=dj_settings.DEFAULT_FROM_EMAIL,
        to=[lead.email],
    )
    msg.content_subtype = "html"
    msg.send(fail_silently=False)

    EmailLog.objects.create(
        lead=lead,
        subject=subject,
        message=reply_body,
        status="sent",
        followup_sent=False,
        auto_replied=True,
        tracking_id=tracking_id,
    )

    logger.info(f"Auto-reply sent to {lead.email}")
    return {"status": "sent", "auto_reply": True}