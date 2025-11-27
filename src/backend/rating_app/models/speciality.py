import uuid

from django.db import models


class Speciality(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255, unique=True)
    faculty = models.ForeignKey("Faculty", on_delete=models.CASCADE, related_name="specialities")
    alias = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        help_text="Custom alias for the speciality. If not provided, the name will be used.",
    )

    def __str__(self):
        return self.name

    class Meta:
        verbose_name = "Speciality"
        verbose_name_plural = "Specialities"
