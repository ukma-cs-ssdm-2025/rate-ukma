import uuid

from django.db import models
from django.db.models import Avg

from .choices import CourseStatus
from .department import Department
from .speciality import Speciality
from .rating import Rating

class Course(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=255)
    description = models.TextField(null=True, blank=True)
    status = models.CharField(max_length=16, choices=CourseStatus.choices)

    department = models.ForeignKey(
        Department, on_delete=models.PROTECT, related_name="courses"
    )
    specialities = models.ManyToManyField(
        Speciality, through="CourseSpeciality", related_name="courses"
    )


    def __str__(self):
        return f"{self.id} — {self.title}"

    def __repr__(self):
        return f"<Course id={self.id} title={self.title}>"

    @property
    def avg_difficulty(self):
        return Rating.objects.filter(course_offering__course=self).aggregate(
            v=Avg("difficulty")
        )["v"]

    @property
    def avg_usefulness(self):
        return Rating.objects.filter(course_offering__course=self).aggregate(
            v=Avg("usefulness")
        )["v"]

    @property
    def ratings_count(self):
        return Rating.objects.filter(course_offering__course=self).count()
