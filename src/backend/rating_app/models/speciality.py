from django.db import models
import uuid


class Speciality(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255, unique=True)

    class Meta:
        managed = False

    def __str__(self):
        return self.name

