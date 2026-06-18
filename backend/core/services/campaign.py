from core.tasks import process_and_send_email


def schedule_campaign(leads, delay_minutes=0):

    for lead in leads:

        process_and_send_email.apply_async(
            args=[
                lead.name,
                lead.email,
                lead.company,
                lead.requirement
            ],
            countdown=delay_minutes * 60
        )

    return True