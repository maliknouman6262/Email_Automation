from django.db import models
import uuid


class Campaign(models.Model):
    name = models.CharField(max_length=255)
    delay_min = models.IntegerField(default=15)
    delay_max = models.IntegerField(default=20)
    status = models.CharField(max_length=50, default="draft")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class Lead(models.Model):
    campaign = models.ForeignKey(
        Campaign, on_delete=models.CASCADE,
        related_name="leads", null=True, blank=True
    )
    name = models.CharField(max_length=255)
    email = models.EmailField()
    company = models.CharField(max_length=255)
    requirement = models.TextField()
    status = models.CharField(max_length=50, default="pending")
    replied = models.BooleanField(default=False)
    replied_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["email"]),
            models.Index(fields=["status"]),
        ]


class EmailLog(models.Model):
    lead = models.ForeignKey(Lead, on_delete=models.CASCADE, related_name="email_logs")
    campaign = models.ForeignKey(Campaign, on_delete=models.CASCADE, null=True, blank=True)
    subject = models.TextField()
    message = models.TextField()
    status = models.CharField(max_length=50, default="sent")
    error_message = models.TextField(null=True, blank=True)
    followup_sent = models.BooleanField(default=False)
    followup_attempt = models.IntegerField(default=0)
    replied = models.BooleanField(default=False)
    reply_text = models.TextField(null=True, blank=True)
    auto_replied = models.BooleanField(default=False)

    # Tracking
    tracking_id = models.UUIDField(default=uuid.uuid4, unique=True, db_index=True)
    opened = models.BooleanField(default=False)
    open_count = models.IntegerField(default=0)
    opened_at = models.DateTimeField(null=True, blank=True)
    clicked = models.BooleanField(default=False)
    click_count = models.IntegerField(default=0)
    clicked_at = models.DateTimeField(null=True, blank=True)

    sent_at = models.DateTimeField(auto_now_add=True)


class FollowUp(models.Model):
    lead = models.ForeignKey(Lead, on_delete=models.CASCADE, related_name="followups")
    campaign = models.ForeignKey(Campaign, on_delete=models.CASCADE, null=True, blank=True)
    attempt = models.IntegerField(default=1)
    scheduled_at = models.DateTimeField()
    status = models.CharField(max_length=50, default="pending")
    sent = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)


class WarmupConfig(models.Model):
    is_active = models.BooleanField(default=True)
    current_day = models.IntegerField(default=1)
    daily_limit = models.IntegerField(default=25)
    emails_sent_today = models.IntegerField(default=0)
    last_reset_date = models.DateField(null=True, blank=True)

    SCHEDULE = {}
    DEFAULT_LIMIT = 25

    def get_limit_for_day(self):
        return 25

    class Meta:
        verbose_name = "Warmup Config"


class FollowUpSettings(models.Model):
    enabled = models.BooleanField(default=True)
    max_attempts = models.IntegerField(default=2)
    followup_days = models.CharField(max_length=50, default="2,5")
    auto_reply_enabled = models.BooleanField(default=False)

    class Meta:
        verbose_name = "Follow-up Settings"