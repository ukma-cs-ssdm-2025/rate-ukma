from django.db import models
import uuid
from rating_app.models.choices import SemesterTerm


class Semester(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    year = models.IntegerField()
    term = models.CharField(max_length=8, choices=SemesterTerm.choices)

    class Meta:
        unique_together = ("year", "term")
        ordering = ["-year", "-term"]
        managed = False

    def __str__(self):
        return f"{self.year} {self.get_term_display()}"
