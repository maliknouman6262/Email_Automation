"""
Gmail IMAP Reader — Fetches replies from inbox
"""
import imaplib
import email
from email.header import decode_header
import logging
from django.conf import settings

logger = logging.getLogger(__name__)


def decode_str(value):
    if not value:
        return ""
    decoded_parts = decode_header(value)
    result = ""
    for part, charset in decoded_parts:
        if isinstance(part, bytes):
            try:
                result += part.decode(charset or "utf-8", errors="ignore")
            except Exception:
                result += part.decode("latin-1", errors="ignore")
        else:
            result += str(part)
    return result


def get_email_body(msg):
    body = ""
    if msg.is_multipart():
        for part in msg.walk():
            content_type = part.get_content_type()
            disposition = str(part.get("Content-Disposition", ""))
            if content_type == "text/plain" and "attachment" not in disposition:
                try:
                    charset = part.get_content_charset() or "utf-8"
                    body = part.get_payload(decode=True).decode(charset, errors="ignore")
                    break
                except Exception:
                    continue
    else:
        try:
            charset = msg.get_content_charset() or "utf-8"
            body = msg.get_payload(decode=True).decode(charset, errors="ignore")
        except Exception:
            body = ""
    return body.strip()


def fetch_replies_imap():
    """
    Connect to Gmail via IMAP and fetch recent replies from known leads.
    FIXED: Check Lead.replied directly, not EmailLog.replied
    """
    from core.models import Lead

    replies = []

    imap_host = getattr(settings, "IMAP_HOST", "imap.gmail.com")
    imap_port = getattr(settings, "IMAP_PORT", 993)
    imap_user = getattr(settings, "IMAP_USER", settings.EMAIL_HOST_USER)
    imap_pass = getattr(settings, "IMAP_PASSWORD", settings.EMAIL_HOST_PASSWORD)

    # All known lead emails
    known_emails_lower = {
        e.lower() for e in Lead.objects.values_list("email", flat=True)
    }

    # ✅ FIXED: Check Lead.replied directly — not EmailLog
    already_replied_lower = {
        e.lower() for e in
        Lead.objects.filter(replied=True).values_list("email", flat=True)
        if e
    }

    try:
        mail = imaplib.IMAP4_SSL(imap_host, imap_port)
        mail.login(imap_user, imap_pass)
        mail.select("INBOX")

        status, all_messages = mail.search(None, "ALL")
        if status != "OK":
            mail.logout()
            return []

        all_ids = all_messages[0].split()
        recent_ids = all_ids[-100:]

        logger.info(f"Checking {len(recent_ids)} recent emails")

        seen_emails = set()  # ✅ Prevent duplicate processing in same run

        for eid in reversed(recent_ids):
            try:
                status, msg_data = mail.fetch(eid, "(RFC822)")
                if status != "OK":
                    continue

                raw = msg_data[0][1]
                msg = email.message_from_bytes(raw)

                from_header = decode_str(msg.get("From", ""))
                subject     = decode_str(msg.get("Subject", ""))
                body        = get_email_body(msg)

                # Extract email address
                from_email = from_header
                if "<" in from_header and ">" in from_header:
                    from_email = from_header.split("<")[1].split(">")[0].strip()
                from_email = from_email.lower().strip()

                if not from_email or "@" not in from_email:
                    continue

                # Skip our own emails
                if from_email == imap_user.lower():
                    continue

                # Only known leads
                if from_email not in known_emails_lower:
                    continue

                # ✅ Skip if lead already replied
                if from_email in already_replied_lower:
                    logger.info(f"Lead {from_email} already replied, skipping")
                    continue

                # ✅ Skip duplicates in same run
                if from_email in seen_emails:
                    continue

                # Must be a reply (Re: subject)
                if not subject.lower().startswith("re:"):
                    continue

                logger.info(f"Reply found: {from_email} | {subject}")
                replies.append({
                    "from_email": from_email,
                    "subject": subject,
                    "body": body,
                    "raw_from": from_header,
                })
                seen_emails.add(from_email)

            except Exception as e:
                logger.error(f"Error email {eid}: {e}")
                continue

        mail.logout()
        logger.info(f"Total replies: {len(replies)}")

    except Exception as e:
        logger.error(f"IMAP error: {e}")

    return replies