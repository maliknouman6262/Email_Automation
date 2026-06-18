import json
import requests
from django.conf import settings


def generate_email(name, company, requirement, sender_profile_json="{}", is_followup=False, previous_context=None):
    url = "https://api.deepinfra.com/v1/openai/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.DEEPINFRA_API_KEY}",
        "Content-Type": "application/json"
    }

    # Parse sender profile
    try:
        sp_raw = json.loads(sender_profile_json) if isinstance(sender_profile_json, str) else sender_profile_json
        sp = sp_raw.get("profile", sp_raw) if "profile" in sp_raw else sp_raw
        es = sp_raw.get("email_style", {})
    except Exception:
        sp = {}
        es = {}

    # Sender info
    sender_name = sp.get("name", "")
    sender_role = sp.get("role", "")
    sender_exp = sp.get("experience", "")
    sender_skills = sp.get("skills", "")
    sender_portfolio = sp.get("portfolio", "")
    sender_linkedin = sp.get("linkedin", "")
    sender_projects = sp.get("projects", "")
    sender_rate = sp.get("rate", "")
    sender_bio = sp.get("bio", "")

    # Email style
    tone = es.get("tone", "professional")
    language = es.get("language", "english")
    emphasis = es.get("emphasis", "")
    avoid = es.get("avoid", "")
    cta = es.get("cta", "")
    extra = es.get("extra", "")

    has_profile = bool(sender_name or sender_role or sender_skills)

    sender_block = f"""SENDER PROFILE:
- Name: {sender_name}
- Role: {sender_role}
- Experience: {sender_exp}
- Skills: {sender_skills}
- Portfolio: {sender_portfolio}
- LinkedIn: {sender_linkedin}
- Past Projects: {sender_projects}
- Rate: {sender_rate}
- Bio: {sender_bio}""" if has_profile else ""

    style_block = f"""WRITING STYLE:
- Tone: {tone}
- Language: {language}
{f'- Emphasize: {emphasis}' if emphasis else ''}
{f'- Avoid: {avoid}' if avoid else ''}
{f'- CTA: {cta}' if cta else ''}
{f'- Extra instructions: {extra}' if extra else ''}"""

    # ── Smart Follow-up with context ──────────────────────────
    if previous_context:
        followup_type = previous_context.get("followup_type", "no_response")
        prev_subject = previous_context.get("subject", "")
        prev_message = previous_context.get("message", "")
        was_opened = previous_context.get("was_opened", False)
        was_clicked = previous_context.get("was_clicked", False)

        if followup_type == "opened_no_reply":
            scenario = f"""The lead OPENED and CLICKED the previous email but has NOT replied yet.
This means they are interested but got busy or need a gentle nudge.
Write a SHORT, warm follow-up (2-3 sentences) acknowledging their interest.
Create urgency without being pushy. Reference that they showed interest."""

        elif followup_type == "no_open":
            scenario = f"""The lead has NOT opened the previous email at all.
They may have missed it or it went to spam.
Write a completely different approach — new angle, new subject line energy.
Do NOT just resend the same message. Find a different hook based on their requirement."""

        else:  # no_response — opened but no click
            scenario = f"""The lead opened the email but did NOT click any links and has not replied.
They read it but weren't compelled enough. 
Write a follow-up that addresses possible objections and adds more value.
Mention a specific result or case study related to their requirement if possible."""

        prompt = f"""You are writing a smart follow-up cold email.

{sender_block}

LEAD INFO:
- Name: {name}
- Company: {company}  
- Requirement: {requirement}

PREVIOUS EMAIL SENT:
Subject: {prev_subject}
---
{prev_message[:1000]}
---

SITUATION:
{scenario}

{style_block}

RULES:
- Read the previous email carefully and write something DIFFERENT, not a copy
- Reference the previous email naturally ("I reached out last week about...")
- Use sender's actual name ({sender_name}) and sign off with it
- Address {name} by name
- Keep it concise — max 4 short paragraphs
- Output ONLY the email body, no subject line, no extra text"""

    # ── Initial Email ─────────────────────────────────────────
    elif is_followup:
        prompt = f"""You are writing a follow-up cold email.

{sender_block}

LEAD INFO:
- Name: {name}
- Company: {company}
- Requirement: {requirement}

{style_block}

RULES:
- This is a follow-up to a previous outreach
- Mention you reached out previously about helping {company}
- Be brief — 3 to 4 sentences max
- Do NOT use "I hope this email finds you well" or similar generic openers
- Sign off with sender's name: {sender_name}
- Output ONLY the email body, no subject line"""

    else:
        prompt = f"""You are writing a cold outreach email.

{sender_block}

LEAD INFO:
- Name: {name}
- Company: {company}
- Requirement: {requirement}

{style_block}

RULES:
- Address {name} by name at the very start
- Reference {company} and their SPECIFIC requirement: "{requirement}"
- Show exactly how sender's skills/experience solves their problem
- Include portfolio or LinkedIn link naturally if available
- Sign off with sender's name: {sender_name}
- Keep it concise — max 5 short paragraphs
- Output ONLY the email body, no subject line"""

    payload = {
        "model": "meta-llama/Meta-Llama-3.1-70B-Instruct",
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.75,
        "max_tokens": 700,
    }

    response = requests.post(url, json=payload, headers=headers, timeout=30)
    data = response.json()
    return data["choices"][0]["message"]["content"]