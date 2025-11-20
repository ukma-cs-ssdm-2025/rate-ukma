import uuid

from django.db import models


class Faculty(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    custom_abbreviation = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        help_text="Custom abbreviation for the faculty. If not provided, the name will be used.",
    )

    def __str__(self):
        return self.name

    def __repr__(self):
        return f"Faculty {self.name}"

    class Meta:
        verbose_name = "Faculty"
        verbose_name_plural = "Faculties"
