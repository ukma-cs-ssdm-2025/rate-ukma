from django.conf import settings
from django.db import models


class ExcludedAccount(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="analytics_exclusion",
    )

    def __str__(self):
        return str(self.user)
