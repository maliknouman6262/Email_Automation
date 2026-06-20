"""
Campaign Service - Handles lead creation and email scheduling
✅ FIXED: Allows duplicate emails to same recipient
"""

from datetime import timedelta
from django.utils import timezone
from core.models import Lead, Campaign, EmailLog
from core.tasks import process_and_send_email
from core.services.email_service import send_ai_email
import random
import json
import logging

logger = logging.getLogger(__name__)


def create_leads_from_extracted(leads_data, campaign_id=None, sender_profile=None):
    """
    Creates Lead objects from extracted data.
    
    ✅ FIXED: Allows duplicate emails (same email, different campaign/time)
    Each lead = separate database record, even if email matches existing lead
    """
    created_leads = []
    
    # Get or create "default" campaign if not specified
    if not campaign_id:
        campaign, _ = Campaign.objects.get_or_create(
            name="Default Campaign",
            defaults={"status": "draft"}
        )
        campaign_id = campaign.id
    else:
        campaign = Campaign.objects.get(id=campaign_id)
    
    for lead_data in leads_data:
        # ✅ FIXED: Don't check if email exists, just create
        # This allows same email to be in multiple campaigns
        lead = Lead.objects.create(
            name=lead_data.get("name", "Unknown"),
            email=lead_data.get("email"),
            company=lead_data.get("company", ""),
            requirement=lead_data.get("requirement", ""),
            campaign=campaign,
            status="pending"
        )
        created_leads.append(lead)
        logger.info(f"Created Lead: {lead.email} (ID: {lead.id})")
    
    return created_leads


def schedule_campaign_emails(leads, base_delay_minutes=2, sender_profile_json="{}"):
    """
    Schedules emails with incremental delays.
    
    For testing:
    - base_delay_minutes=2 → 2, 4, 6, 8 min delays
    
    For production:
    - base_delay_minutes=15 → 15, 30, 45, 60 min delays
    """
    
    scheduled_tasks = []
    skipped_duplicates = 0  # Will be 0 now since we allow all
    
    for index, lead in enumerate(leads):
        # Calculate delay: 2, 4, 6, 8... OR 15, 30, 45, 60...
        delay_minutes = base_delay_minutes + (index * 2)
        
        task = process_and_send_email.apply_async(
            args=[
                lead.name,
                lead.email,
                lead.company,
                lead.requirement,
                sender_profile_json
            ],
            kwargs={"lead_id": lead.id},  # ✅ Pass lead_id for tracking
            countdown=delay_minutes * 60  # Convert to seconds
        )
        
        scheduled_tasks.append({
            "lead_id": lead.id,
            "lead": lead.email,
            "task_id": task.id,
            "delay_minutes": delay_minutes,
            "name": lead.name,
            "company": lead.company
        })
        
        logger.info(f"Scheduled email to {lead.email} in {delay_minutes} minutes (Task ID: {task.id})")
    
    return {
        "scheduled": len(scheduled_tasks),
        "skipped_duplicates": 0,  # ✅ Always 0 now
        "avg_gap_minutes": base_delay_minutes if not scheduled_tasks else scheduled_tasks[-1]["delay_minutes"] / len(scheduled_tasks),
        "tasks": scheduled_tasks
    }


def get_campaign_stats(campaign_id):
    """Get email stats for a campaign."""
    campaign = Campaign.objects.get(id=campaign_id)
    leads = campaign.lead_set.all()
    
    total_leads = leads.count()
    email_logs = EmailLog.objects.filter(lead__in=leads)
    
    sent = email_logs.filter(status="sent").count()
    opened = email_logs.filter(opened=True).count()
    clicked = email_logs.filter(clicked=True).count()
    replied = leads.filter(replied=True).count()
    
    return {
        "campaign": campaign.name,
        "total_leads": total_leads,
        "emails_sent": sent,
        "emails_opened": opened,
        "emails_clicked": clicked,
        "replies": replied,
        "open_rate": round((opened / sent * 100) if sent > 0 else 0, 1),
        "click_rate": round((clicked / sent * 100) if sent > 0 else 0, 1),
    }