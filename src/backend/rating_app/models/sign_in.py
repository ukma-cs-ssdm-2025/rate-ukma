from django.conf import settings
from django.db import models


class SignIn(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="sign_ins",
    )
    signed_in_at = models.DateTimeField(auto_now_add=True)
