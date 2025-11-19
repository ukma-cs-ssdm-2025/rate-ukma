import uuid

from django.db import models

from rating_app.models.choices import SemesterTerm


class Semester(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    year = models.IntegerField()
    term = models.CharField(max_length=8, choices=SemesterTerm.choices, null=False)

    class Meta:
        unique_together = ("year", "term")
        ordering = ["-year", "-term"]

    def __str__(self):
        return f"{self.year} {self.get_term_display()}"

    @property
    def label(self):
        return SemesterTerm(self.term).label
