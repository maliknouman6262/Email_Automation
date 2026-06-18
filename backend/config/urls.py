from django.contrib import admin
from django.urls import path, include
from core.views import test_email

urlpatterns = [
    path('admin/', admin.site.urls),
    path("test-email/", test_email),
    path("api/", include("core.urls")),  # ← ye add karo
]