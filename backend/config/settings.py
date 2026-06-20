from celery.schedules import crontab
from pathlib import Path
import os

BASE_DIR = Path(__file__).resolve().parent.parent

# ─── Core ───────────────────────────────────────────────────
SECRET_KEY = os.getenv("SECRET_KEY", "django-insecure-va&yxqi(zur1&0hj&a9g5$7lc)-&a#vt952@vddwz)2*m3c(^z")
DEBUG = os.getenv("DEBUG", "True") == "True"
ALLOWED_HOSTS = ["*"]

DEEPINFRA_API_KEY = os.getenv("DEEPINFRA_API_KEY", "arqjSxxbiA3g66FEzNnPgdvpcdbgXuJw")

# ─── Site URL (tracking ke liye) ────────────────────────────
SITE_BASE_URL = os.getenv("SITE_BASE_URL", "http://127.0.0.1:8000")

# ─── Apps ───────────────────────────────────────────────────
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'corsheaders',
    'rest_framework',
    'core',
    'django_celery_beat',
]

CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "https://email-automation-eight-eta.vercel.app",
]
CORS_ALLOW_ALL_ORIGINS = True

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

# ─── Database ───────────────────────────────────────────────
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}

# ─── Email (Gmail SMTP) ─────────────────────────────────────
EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
EMAIL_HOST = os.getenv("EMAIL_HOST", "smtp.gmail.com")
EMAIL_PORT = int(os.getenv("EMAIL_PORT", "587"))
EMAIL_USE_TLS = os.getenv("EMAIL_USE_TLS", "True") == "True"
EMAIL_USE_SSL = os.getenv("EMAIL_USE_SSL", "False") == "True"
EMAIL_HOST_USER = os.getenv("EMAIL_HOST_USER", "jaffar62malik@gmail.com")
EMAIL_HOST_PASSWORD = os.getenv("EMAIL_HOST_PASSWORD", "fsqokcxdqcmkjgfw")
DEFAULT_FROM_EMAIL = EMAIL_HOST_USER

# ─── IMAP (Reply detection) ──────────────────────────────────
IMAP_HOST = os.getenv("IMAP_HOST", "imap.gmail.com")
IMAP_PORT = int(os.getenv("IMAP_PORT", "993"))
IMAP_USER = os.getenv("IMAP_USER", EMAIL_HOST_USER)
IMAP_PASSWORD = os.getenv("IMAP_PASSWORD", EMAIL_HOST_PASSWORD)

# ─── Celery ─────────────────────────────────────────────────
CELERY_BROKER_URL = os.getenv(
    "CELERY_BROKER_URL",
    "rediss://default:gQAAAAAAAkqOAAIgcDE2ZmFmYzdhNjlmM2U0Y2ZiODRhYThiMmM1ZDQzYzU5NQ@quick-jackass-150158.upstash.io:6379?ssl_cert_reqs=CERT_NONE"
)
CELERY_RESULT_BACKEND = os.getenv(
    "CELERY_RESULT_BACKEND",
    "rediss://default:gQAAAAAAAkqOAAIgcDE2ZmFmYzdhNjlmM2U0Y2ZiODRhYThiMmM1ZDQzYzU5NQ@quick-jackass-150158.upstash.io:6379?ssl_cert_reqs=CERT_NONE"
)
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = 'Asia/Karachi'

CELERY_BEAT_SCHEDULE = {
    "check-smart-followups": {
        "task": "core.tasks.check_and_schedule_followups",
        "schedule": crontab(minute="*/5"),
    },
    "check-auto-replies": {
        "task": "core.tasks.check_and_auto_reply",
        "schedule": crontab(minute="*/5"),
    },
}

# ─── Auth ───────────────────────────────────────────────────
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# ─── i18n ───────────────────────────────────────────────────
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'