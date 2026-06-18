from django.conf import settings
from django.http import JsonResponse
from rest_framework.decorators import api_view, parser_classes
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response

from core.tasks import process_and_send_email, send_smart_followup, check_and_schedule_followups
from .models import Lead, Campaign, EmailLog
from .serializers import LeadSerializer, CampaignSerializer
from core.services.campaign_service import schedule_campaign_emails as run_campaign_scheduler
from core.services.parser import parse_file

import json
import random
import base64
import requests


# ─────────────────────────────────────────────
# HELPER: Call DeepInfra LLM
# ─────────────────────────────────────────────
def call_ai(prompt: str, max_tokens: int = 4096) -> str:
    url = "https://api.deepinfra.com/v1/openai/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.DEEPINFRA_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": "meta-llama/Meta-Llama-3.1-70B-Instruct",
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": max_tokens,
    }
    r = requests.post(url, headers=headers, json=payload, timeout=60)
    r.raise_for_status()
    return r.json()["choices"][0]["message"]["content"].strip()


def call_ai_vision(image_base64: str, media_type: str, prompt: str) -> str:
    """DeepInfra vision call for image/screenshot analysis."""
    url = "https://api.deepinfra.com/v1/openai/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.DEEPINFRA_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": "meta-llama/Llama-3.2-90B-Vision-Instruct",
        "messages": [{
            "role": "user",
            "content": [
                {
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:{media_type};base64,{image_base64}"
                    }
                },
                {"type": "text", "text": prompt}
            ]
        }],
        "max_tokens": 4096,
    }
    r = requests.post(url, headers=headers, json=payload, timeout=60)
    r.raise_for_status()
    return r.json()["choices"][0]["message"]["content"].strip()


def parse_json_response(raw: str) -> list:
    """Strip markdown fences and parse JSON array."""
    if "```" in raw:
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    raw = raw.strip()
    # Find JSON array boundaries
    start = raw.find("[")
    end = raw.rfind("]") + 1
    if start != -1 and end > start:
        raw = raw[start:end]
    return json.loads(raw)


# ─────────────────────────────────────────────
# HELPER: Analyze text leads with AI
# ─────────────────────────────────────────────
def analyze_leads_with_ai(raw_content: str, file_type: str = "text") -> list:
    prompt = f"""You are a lead data extractor. Extract all valid business leads from the content below.

Rules:
- Only include leads where email looks valid (not fake/test/placeholder)
- Skip rows missing name, email, or company
- Extract the requirement/need from any description or notes columns
- Return ONLY a JSON array, no explanation, no markdown fences

Each object must have exactly these keys:
{{"name": "Full Name", "email": "valid@email.com", "company": "Company Name", "requirement": "What they need"}}

File type: {file_type}
Content:
{raw_content[:6000]}

Return only the JSON array."""

    raw = call_ai(prompt)
    return parse_json_response(raw)


def analyze_image_leads_with_ai(image_base64: str, media_type: str) -> list:
    prompt = """Extract all business leads visible in this image/screenshot.

Return ONLY a JSON array with objects having these exact keys:
{"name": "Full Name", "email": "email@domain.com", "company": "Company", "requirement": "what they need"}

Skip any leads with missing data or invalid emails. Return only the JSON array, no explanation."""

    raw = call_ai_vision(image_base64, media_type, prompt)
    return parse_json_response(raw)


# ─────────────────────────────────────────────
# UPLOAD & ANALYZE LEADS (Any Format)
# ─────────────────────────────────────────────
@api_view(["POST"])
@parser_classes([MultiPartParser, FormParser])
def upload_and_analyze_leads(request):
    file = request.FILES.get("file")
    if not file:
        return Response({"error": "No file provided"}, status=400)

    filename = file.name.lower()
    content_type = file.content_type or ""

    image_types = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"]
    image_extensions = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"]

    is_image = (
        any(filename.endswith(ext) for ext in image_extensions)
        or content_type in image_types
    )

    try:
        if is_image:
            raw_bytes = file.read()
            image_b64 = base64.standard_b64encode(raw_bytes).decode("utf-8")
            media = content_type if content_type in image_types else "image/png"
            leads_data = analyze_image_leads_with_ai(image_b64, media)

        elif filename.endswith((".xlsx", ".xls")):
            leads_raw = parse_file(file)
            raw_text = "\n".join([str(r) for r in leads_raw])
            leads_data = analyze_leads_with_ai(raw_text, "excel rows")

        elif filename.endswith(".csv"):
            raw_text = file.read().decode("utf-8", errors="ignore")
            leads_data = analyze_leads_with_ai(raw_text, "CSV")

        elif filename.endswith(".json"):
            raw_text = file.read().decode("utf-8", errors="ignore")
            leads_data = analyze_leads_with_ai(raw_text, "JSON")

        else:
            raw_text = file.read().decode("utf-8", errors="ignore")
            leads_data = analyze_leads_with_ai(raw_text, "plain text")

    except json.JSONDecodeError:
        return Response({"error": "AI could not extract leads. Check file content."}, status=422)
    except Exception as e:
        return Response({"error": str(e)}, status=500)

    if not leads_data:
        return Response({"message": "No valid leads found.", "leads": [], "count": 0})

    return Response({
        "message": f"AI extracted {len(leads_data)} valid leads",
        "leads": leads_data,
        "count": len(leads_data)
    })


# ─────────────────────────────────────────────
# CONFIRM & SAVE + AUTO SCHEDULE
# ─────────────────────────────────────────────
@api_view(["POST"])
def confirm_and_schedule_leads(request):
    leads_data = request.data.get("leads", [])
    sender_profile = request.data.get("sender_profile", {})
    campaign_id = request.data.get("campaign_id", None)

    if not leads_data:
        return Response({"error": "No leads to save"}, status=400)

    campaign = None
    if campaign_id:
        try:
            campaign = Campaign.objects.get(id=campaign_id)
        except Campaign.DoesNotExist:
            pass

    test_mode = request.data.get("test_mode", False)
    # Test mode: 2-5 min gaps | Normal: 15-20 min gaps
    gap_min = 2 * 60 if test_mode else 15 * 60
    gap_max = 5 * 60 if test_mode else 20 * 60

    saved_leads = []
    cumulative_delay = 0

    for lead_data in leads_data:
        if Lead.objects.filter(email=lead_data["email"]).exists():
            continue

        lead = Lead.objects.create(
            name=lead_data["name"],
            email=lead_data["email"],
            company=lead_data["company"],
            requirement=lead_data.get("requirement", ""),
            campaign=campaign,
            status="pending"
        )
        saved_leads.append(lead)

        gap = random.randint(gap_min, gap_max)
        cumulative_delay += gap

        # Schedule initial email
        process_and_send_email.apply_async(
            args=[
                lead.name,
                lead.email,
                lead.company,
                lead.requirement,
                json.dumps(sender_profile)
            ],
            countdown=cumulative_delay
        )

        # Smart followup will be triggered automatically by
        # check_and_schedule_followups periodic task based on engagement

    avg_gap = (gap_min + gap_max) / 2 / 60
    return Response({
        "message": f"{len(saved_leads)} leads saved and emails scheduled.",
        "scheduled": len(saved_leads),
        "skipped_duplicates": len(leads_data) - len(saved_leads),
        "first_email_in_minutes": round(avg_gap, 1),
        "avg_gap_minutes": round(avg_gap, 1),
        "test_mode": test_mode,
    })


# ─────────────────────────────────────────────
# CREATE SINGLE LEAD
# ─────────────────────────────────────────────
@api_view(["POST"])
def create_lead(request):
    serializer = LeadSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=400)


# ─────────────────────────────────────────────
# LIST LEADS
# ─────────────────────────────────────────────
@api_view(["GET"])
def list_leads(request):
    leads = Lead.objects.all().order_by("-created_at")
    serializer = LeadSerializer(leads, many=True)
    return Response(serializer.data)


# ─────────────────────────────────────────────
# DASHBOARD STATS
# ─────────────────────────────────────────────
@api_view(["GET"])
def dashboard_stats(request):
    from django.utils import timezone
    from datetime import timedelta

    total = Lead.objects.exclude(name="__sender_profile__").count()
    sent = Lead.objects.filter(status="sent").count()
    pending = Lead.objects.filter(status="pending").count()
    failed = EmailLog.objects.filter(status="failed").count()

    # Recent activity - last 20 email logs
    recent_logs = EmailLog.objects.select_related("lead").order_by("-sent_at")[:20]
    recent = []
    for log in recent_logs:
        diff = timezone.now() - log.sent_at
        mins = int(diff.total_seconds() / 60)
        if mins < 1:
            time_str = "Just now"
        elif mins < 60:
            time_str = f"{mins} min ago"
        elif mins < 1440:
            time_str = f"{mins // 60} hr ago"
        else:
            time_str = f"{mins // 1440} day ago"

        recent.append({
            "name": log.lead.name,
            "company": log.lead.company,
            "email": log.lead.email,
            "status": log.status,
            "is_followup": log.followup_sent,
            "opened": log.opened,
            "clicked": log.clicked,
            "time": time_str,
        })

    return Response({
        "total_leads": total,
        "sent": sent,
        "pending": pending,
        "failed": failed,
        "recent": recent,
    })


# ─────────────────────────────────────────────
# SENDER PROFILE
# ─────────────────────────────────────────────
@api_view(["GET", "POST"])
def sender_profile(request):
    PROFILE_KEY = "__sender_profile__"

    if request.method == "GET":
        try:
            camp = Campaign.objects.get(name=PROFILE_KEY)
            profile = json.loads(camp.status) if camp.status != "draft" else {}
            return Response({"profile": profile})
        except Campaign.DoesNotExist:
            return Response({"profile": {}})

    profile_data = request.data.get("profile", {})
    camp, _ = Campaign.objects.get_or_create(name=PROFILE_KEY)
    camp.status = json.dumps(profile_data)
    camp.save()
    return Response({"message": "Profile saved", "profile": profile_data})


# ─────────────────────────────────────────────
# SEND CAMPAIGN (MANUAL)
# ─────────────────────────────────────────────
@api_view(["POST"])
def send_campaign(request):
    lead_ids = request.data.get("lead_ids", [])
    delay = int(request.data.get("delay_minutes", 15))
    leads = Lead.objects.filter(id__in=lead_ids)

    cumulative = 0
    for lead in leads:
        gap = random.randint(delay * 60, (delay + 5) * 60)
        cumulative += gap
        process_and_send_email.apply_async(
            args=[lead.name, lead.email, lead.company, lead.requirement],
            countdown=cumulative
        )

    return Response({"message": "Campaign scheduled", "total": leads.count()})


# ─────────────────────────────────────────────
# PREVIEW EMAIL
# ─────────────────────────────────────────────
@api_view(["POST"])
def preview_email(request):
    lead = request.data.get("lead", {})
    sp = request.data.get("sender_profile", {})
    es = request.data.get("email_style", {})

    prompt = f"""You are writing a cold outreach email on behalf of {sp.get('name', 'the sender')}.

SENDER PROFILE:
- Name: {sp.get('name', '')}
- Role: {sp.get('role', '')}
- Experience: {sp.get('experience', '')}
- Skills: {sp.get('skills', '')}
- Portfolio: {sp.get('portfolio', '')}
- LinkedIn: {sp.get('linkedin', '')}
- Past Projects: {sp.get('projects', '')}
- Rate: {sp.get('rate', '')}
- Bio: {sp.get('bio', '')}

LEAD INFO:
- Name: {lead.get('name', '')}
- Company: {lead.get('company', '')}
- Requirement: {lead.get('requirement', '')}

EMAIL INSTRUCTIONS:
- Tone: {es.get('tone', 'professional')}
- Language: {es.get('language', 'english')}
- Emphasize: {es.get('emphasis', '')}
- Avoid: {es.get('avoid', '')}
- CTA: {es.get('cta', '')}
- Extra: {es.get('extra', '')}

Write a personalized cold email proposing how the sender can help this lead.
Use sender's actual experience and skills. Make it feel custom-written.
Start with: Subject: ...
Then write the email body."""

    try:
        email_text = call_ai(prompt, max_tokens=1000)
        return Response({"email": email_text})
    except Exception as e:
        return Response({"error": str(e)}, status=500)


# ─────────────────────────────────────────────
# FOLLOW-UP
# ─────────────────────────────────────────────
@api_view(["POST"])
def schedule_followup(request):
    lead_id = request.data.get("lead_id")
    test_mode = request.data.get("test_mode", False)
    lead = Lead.objects.get(id=lead_id)
    countdown = 5 * 60 if test_mode else 86400
    label = "5 minutes" if test_mode else "24 hours"

    # Load sender profile to personalize followup
    sender_profile = {}
    try:
        camp = Campaign.objects.get(name="__sender_profile__")
        sender_profile = json.loads(camp.status) if camp.status != "draft" else {}
    except Campaign.DoesNotExist:
        pass

    send_smart_followup.apply_async(
        args=[lead.id, "no_response", json.dumps(sender_profile)],
        countdown=countdown
    )
    return Response({"message": f"Follow-up scheduled after {label}", "test_mode": test_mode})


# ─────────────────────────────────────────────
# TEST EMAIL
# ─────────────────────────────────────────────
def test_email(request):
    process_and_send_email.delay(
        "Ali", "test@example.com", "ABC Company", "Need website development"
    )
    return JsonResponse({"status": "task queued"})


# ─────────────────────────────────────────────
# EMAIL OPEN TRACKING (1x1 pixel)
# ─────────────────────────────────────────────
from django.http import HttpResponse
from django.utils import timezone

def track_open(request, tracking_id):
    """Called when email is opened (invisible 1x1 pixel loaded)."""
    try:
        log = EmailLog.objects.get(tracking_id=tracking_id)
        log.open_count += 1
        if not log.opened:
            log.opened = True
            log.opened_at = timezone.now()
        log.save()
    except EmailLog.DoesNotExist:
        pass

    # Return 1x1 transparent GIF
    pixel = b'\x47\x49\x46\x38\x39\x61\x01\x00\x01\x00\x80\x00\x00\xff\xff\xff\x00\x00\x00\x21\xf9\x04\x00\x00\x00\x00\x00\x2c\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02\x44\x01\x00\x3b'
    return HttpResponse(pixel, content_type="image/gif")


# ─────────────────────────────────────────────
# CLICK TRACKING (redirect)
# ─────────────────────────────────────────────
from django.shortcuts import redirect as django_redirect

def track_click(request, tracking_id):
    """Called when a tracked link is clicked."""
    url = request.GET.get("url", "/")
    try:
        log = EmailLog.objects.get(tracking_id=tracking_id)
        log.click_count += 1
        if not log.clicked:
            log.clicked = True
            log.clicked_at = timezone.now()
        log.save()
    except EmailLog.DoesNotExist:
        pass
    return django_redirect(url)


# ─────────────────────────────────────────────
# WARMUP CONFIG — GET / UPDATE
# ─────────────────────────────────────────────
@api_view(["GET", "POST"])
def warmup_config(request):
    from core.models import WarmupConfig
    from datetime import date

    config, _ = WarmupConfig.objects.get_or_create(pk=1)

    FIXED_DAILY_LIMIT = 25  # Already warmed up account

    if request.method == "GET":
        from datetime import date as _date
        today = _date.today()
        if config.last_reset_date != today:
            config.emails_sent_today = 0
            config.last_reset_date = today
            config.save()
        return Response({
            "is_active": config.is_active,
            "current_day": config.current_day,
            "daily_limit": FIXED_DAILY_LIMIT,
            "emails_sent_today": config.emails_sent_today,
            "remaining_today": max(0, FIXED_DAILY_LIMIT - config.emails_sent_today),
            "last_reset_date": str(config.last_reset_date),
        })

    # POST — toggle warmup
    if "is_active" in request.data:
        config.is_active = request.data["is_active"]
    if "advance_day" in request.data and request.data["advance_day"]:
        config.current_day += 1
        config.emails_sent_today = 0
        config.last_reset_date = date.today()
    config.save()
    return Response({
        "message": "Warmup updated",
        "is_active": config.is_active,
        "daily_limit": FIXED_DAILY_LIMIT,
        "emails_sent_today": config.emails_sent_today,
    })


# ─────────────────────────────────────────────
# TRACKING STATS for dashboard
# ─────────────────────────────────────────────
@api_view(["GET"])
def tracking_stats(request):
    total_sent = EmailLog.objects.filter(status="sent").count()
    total_opened = EmailLog.objects.filter(opened=True).count()
    total_clicked = EmailLog.objects.filter(clicked=True).count()
    followups_sent = EmailLog.objects.filter(status="sent", followup_sent=True).count()

    open_rate = round((total_opened / total_sent * 100), 1) if total_sent > 0 else 0
    click_rate = round((total_clicked / total_sent * 100), 1) if total_sent > 0 else 0

    return Response({
        "total_sent": total_sent,
        "total_opened": total_opened,
        "total_clicked": total_clicked,
        "followups_sent": followups_sent,
        "open_rate": open_rate,
        "click_rate": click_rate,
    })


# ─────────────────────────────────────────────
# FOLLOW-UP SETTINGS
# ─────────────────────────────────────────────
@api_view(["GET", "POST"])
def followup_settings(request):
    from core.models import FollowUpSettings
    obj, _ = FollowUpSettings.objects.get_or_create(pk=1)

    if request.method == "GET":
        return Response({
            "enabled": obj.enabled,
            "max_attempts": obj.max_attempts,
            "followup_days": obj.followup_days,
            "auto_reply_enabled": obj.auto_reply_enabled,
        })

    if "enabled" in request.data:
        obj.enabled = request.data["enabled"]
    if "max_attempts" in request.data:
        obj.max_attempts = int(request.data["max_attempts"])
    if "followup_days" in request.data:
        obj.followup_days = request.data["followup_days"]
    if "auto_reply_enabled" in request.data:
        obj.auto_reply_enabled = request.data["auto_reply_enabled"]
    obj.save()
    return Response({"message": "Settings saved", "enabled": obj.enabled,
                     "max_attempts": obj.max_attempts, "followup_days": obj.followup_days,
                     "auto_reply_enabled": obj.auto_reply_enabled})


# ─────────────────────────────────────────────
# FULL REPORT STATS
# ─────────────────────────────────────────────
@api_view(["GET"])
def report_stats(request):
    from core.models import Lead, EmailLog
    from django.db.models import Count

    total_leads = Lead.objects.exclude(name="__sender_profile__").count()
    total_sent = EmailLog.objects.filter(status="sent", followup_sent=False).count()
    total_followups = EmailLog.objects.filter(status="sent", followup_sent=True).count()
    total_opened = EmailLog.objects.filter(opened=True).count()
    total_clicked = EmailLog.objects.filter(clicked=True).count()
    total_replied = Lead.objects.filter(replied=True).count()
    total_auto_replied = EmailLog.objects.filter(auto_replied=True).count()
    total_failed = EmailLog.objects.filter(status="failed").count()

    open_rate = round(total_opened / total_sent * 100, 1) if total_sent > 0 else 0
    click_rate = round(total_clicked / total_sent * 100, 1) if total_sent > 0 else 0
    reply_rate = round(total_replied / total_leads * 100, 1) if total_leads > 0 else 0
    response_rate = round((total_replied / total_sent * 100), 1) if total_sent > 0 else 0
    delivery_rate = round(((total_sent) / (total_sent + total_failed) * 100), 1) if (total_sent + total_failed) > 0 else 0

    return Response({
        "total_leads": total_leads,
        "total_sent": total_sent,
        "total_followups": total_followups,
        "total_opened": total_opened,
        "total_clicked": total_clicked,
        "total_replied": total_replied,
        "total_auto_replied": total_auto_replied,
        "total_failed": total_failed,
        "open_rate": open_rate,
        "click_rate": click_rate,
        "reply_rate": reply_rate,
        "response_rate": response_rate,
        "delivery_rate": delivery_rate,
    })