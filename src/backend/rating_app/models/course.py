import uuid
from typing import Any, Protocol, runtime_checkable

from django.db import models

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

    avg_difficulty = models.DecimalField(max_digits=3, decimal_places=2, default=0.0)
    avg_usefulness = models.DecimalField(max_digits=3, decimal_places=2, default=0.0)
    ratings_count = models.PositiveIntegerField(default=0)

    class Meta:
        indexes = [
            models.Index(fields=["ratings_count"], name="course_ratings_count_idx"),
            models.Index(fields=["avg_difficulty"], name="course_avg_difficulty_idx"),
            models.Index(fields=["avg_usefulness"], name="course_avg_usefulness_idx"),
            models.Index(fields=["title"], name="course_title_idx"),
        ]

    def __str__(self):
        return f"{self.id} — {self.title}"

    def __repr__(self):
        return f"<{self.__class__.__name__} id={self.id} title={self.title}>"
