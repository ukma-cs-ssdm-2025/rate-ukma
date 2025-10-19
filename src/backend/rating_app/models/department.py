import uuid

from django.db import models


class Department(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    faculty = models.ForeignKey("Faculty", on_delete=models.CASCADE, related_name="departments")

    def __str__(self):
        return self.name

    def __repr__(self):
        return f"Department {self.name}"

    class Meta:
        verbose_name = "Department"
        verbose_name_plural = "Departments"
