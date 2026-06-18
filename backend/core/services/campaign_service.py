from datetime import timedelta
from django.utils import timezone
from core.tasks import process_and_send_email


def schedule_campaign_emails(leads, base_delay_minutes=15):
    """
    Sends emails in batch with incremental delay:
    0 min, 15 min, 30 min, 45 min...
    """

    scheduled_tasks = []

    for index, lead in enumerate(leads):

        delay_minutes = index * 2 

        task = process_and_send_email.apply_async(
            args=[
                lead.name,
                lead.email,
                lead.company,
                lead.requirement
            ],
            countdown=delay_minutes * 60
        )

        scheduled_tasks.append({
            "lead": lead.email,
            "task_id": task.id,
            "delay_minutes": delay_minutes
        })

    return scheduled_tasks