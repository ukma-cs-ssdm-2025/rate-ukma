import uuid

from django.db import models


class Person(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    first_name = models.CharField(max_length=120)
    patronymic = models.CharField(max_length=120, blank=True, default="")
    last_name = models.CharField(max_length=120)

    class Meta:
        abstract = True

    def __str__(self):
        parts = [self.last_name, self.first_name]
        return " ".join(str(p) for p in parts if p)
