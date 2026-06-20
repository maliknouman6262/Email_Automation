from django.urls import path
from . import views

urlpatterns = [
    path("leads/", views.list_leads),
    path("leads/create/", views.create_lead),
    path("leads/upload/", views.upload_and_analyze_leads),
    path("leads/confirm/", views.confirm_and_schedule_leads),

    path("campaign/send/", views.send_campaign),
    path("campaign/preview-email/", views.preview_email),

    path("profile/", views.sender_profile),

    path("dashboard/stats/", views.dashboard_stats),
    path("dashboard/tracking/", views.tracking_stats),
    path("dashboard/report/", views.report_stats),

    path("warmup/", views.warmup_config),
    path("followup-settings/", views.followup_settings),

    path("followups/run/", views.schedule_followup),

    path("track/open/<uuid:tracking_id>/", views.track_open),
    path("track/click/<uuid:tracking_id>/", views.track_click),
    path("dashboard/emails/", views.pending_emails),
    path("dashboard/emails/", views.email_activity),

]