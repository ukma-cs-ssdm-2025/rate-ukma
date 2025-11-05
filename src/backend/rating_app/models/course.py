import uuid

from django.db import models
from django.db.models import Avg

from .choices import CourseStatus
from .department import Department
from .speciality import Speciality


class Course(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    status = models.CharField(max_length=16, choices=CourseStatus.choices)

    department = models.ForeignKey(Department, on_delete=models.PROTECT, related_name="courses")
    specialities = models.ManyToManyField(
        Speciality, through="CourseSpeciality", related_name="courses"
    )

    def __str__(self):
        return f"{self.id} — {self.title}"

    def __repr__(self):
        return f"<Course id={self.id} title={self.title}>"

    @property
    def avg_difficulty(self):
        """
        Return average difficulty rating.
        Uses pre-annotated value if available (from repository), otherwise queries DB.
        """
        # Check if value was pre-annotated by repository
        if hasattr(self, "avg_difficulty_annot"):
            return self.avg_difficulty_annot

        # Fallback to DB query
        from .rating import Rating

        return Rating.objects.filter(course_offering__course=self).aggregate(v=Avg("difficulty"))[
            "v"
        ]

    @property
    def avg_usefulness(self):
        """
        Return average usefulness rating.
        Uses pre-annotated value if available (from repository), otherwise queries DB.
        """
        # Check if value was pre-annotated by repository
        if hasattr(self, "avg_usefulness_annot"):
            return self.avg_usefulness_annot

        # Fallback to DB query
        from .rating import Rating

        return Rating.objects.filter(course_offering__course=self).aggregate(v=Avg("usefulness"))[
            "v"
        ]

    @property
    def ratings_count(self) -> int | None:
        """
        Return total count of ratings, or None if no ratings exist.
        Uses pre-annotated value if available (from repository), otherwise queries DB.
        """
        # Check if value was pre-annotated by repository
        if hasattr(self, "ratings_count_annot"):
            count = self.ratings_count_annot
            return None if count == 0 else count

        # Fallback to DB query
        from .rating import Rating

        count = Rating.objects.filter(course_offering__course=self).count()
        return None if count == 0 else count
