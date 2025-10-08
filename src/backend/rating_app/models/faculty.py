from django.db import models
import uuid

class Faculty(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)

    def __str__(self): 
        return self.name
    def __repr__(self): 
        return f"Faculty {self.name}"


    class Meta:
        verbose_name = "Faculty"
        verbose_name_plural = "Faculties"
        managed = False

