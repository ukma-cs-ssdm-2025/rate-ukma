import uuid
from typing import Any, Protocol, runtime_checkable

from django.db import models
from django.db.models import Avg

from .choices import CourseStatus
from .department import Department
from .speciality import Speciality


# placed near the model for clarity
@runtime_checkable
class ICourse(Protocol):
    id: uuid.UUID
    title: str
    description: str
    status: CourseStatus
    department_id: uuid.UUID
    department_name: str
    faculty_name: str
    specialities: list[dict[str, Any]]  # TODO: checks if this is correct

    @property
    def avg_difficulty(self) -> float | None: ...
    @property
    def avg_usefulness(self) -> float | None: ...
    @property
    def ratings_count(self) -> int | None: ...


class Course(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    status = models.CharField(max_length=16, choices=CourseStatus.choices)

    department = models.ForeignKey(Department, on_delete=models.PROTECT, related_name="courses")
    specialities = models.ManyToManyField(
        Speciality, through="CourseSpeciality", related_name="courses"
    )

    avg_difficulty_annot: float | None = None
    avg_usefulness_annot: float | None = None
    ratings_count_annot: int | None = None

    def __str__(self):
        return f"{self.id} — {self.title}"

    def __repr__(self):
        return f"<{self.__class__.__name__} id={self.id} title={self.title}>"

    @property
    def avg_difficulty(self):
        if self.avg_difficulty_annot is not None:
            return self.avg_difficulty_annot

        # Fallback to DB query if not annotated
        from .rating import Rating

        return Rating.objects.filter(course_offering__course=self).aggregate(v=Avg("difficulty"))[
            "v"
        ]

    @property
    def avg_usefulness(self):
        if self.avg_usefulness_annot is not None:
            return self.avg_usefulness_annot

        # Fallback to DB query if not annotated
        from .rating import Rating

        return Rating.objects.filter(course_offering__course=self).aggregate(v=Avg("usefulness"))[
            "v"
        ]

    @property
    def ratings_count(self) -> int | None:
        if self.ratings_count_annot is not None:
            count = self.ratings_count_annot
            return None if count == 0 else count

        # Fallback to DB query if not annotated
        from .rating import Rating

        count = Rating.objects.filter(course_offering__course=self).count()
        return None if count == 0 else count
