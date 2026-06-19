import os
from celery import Celery

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

app = Celery('config')

app.config_from_object('django.conf:settings', namespace='CELERY')

# ✅ CONNECTION RETRY SETTINGS
app.conf.broker_connection_retry_on_startup = True
app.conf.broker_connection_retry = True
app.conf.broker_connection_max_retries = 10

# ✅ REDIS CONNECTION OPTIONS
app.conf.broker_transport_options = {
    'socket_connect_timeout': 5,
    'socket_keepalive': True,
    'health_check_interval': 30,
    'max_retries': 5,
    'retry_on_timeout': True,
}

# ✅ TASK RETRY SETTINGS
app.conf.task_acks_late = True
app.conf.task_reject_on_worker_lost = True
app.conf.worker_max_tasks_per_child = 1000
app.conf.worker_disable_rate_limits = False

# ✅ TIMEOUT SETTINGS
app.conf.task_soft_time_limit = 600  # 10 minutes
app.conf.task_time_limit = 900  # 15 minutes

app.autodiscover_tasks()