from __future__ import annotations

import uuid
from decimal import Decimal
from typing import TYPE_CHECKING, Protocol

from django.contrib.postgres.indexes import GinIndex
from django.db import models
from django.db.models import Manager

from .choices import CourseStatus, EducationLevel
from .department import Department

if TYPE_CHECKING:
    from .course_offering import CourseOffering
    from .speciality import Speciality

    class _SpecialitiesRelation(Protocol):
        def add(self, *objs: Speciality) -> None: ...


class Course(models.Model):
    department_id: uuid.UUID
    offerings: Manager[CourseOffering]
    specialities: _SpecialitiesRelation

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    status = models.CharField(max_length=16, choices=CourseStatus.choices)
    education_level = models.CharField(
        max_length=16,
        choices=EducationLevel.choices,
        blank=True,
        default="",
    )

    department = models.ForeignKey(Department, on_delete=models.PROTECT, related_name="courses")

    avg_difficulty = models.DecimalField(max_digits=3, decimal_places=2, default=Decimal("0.0"))
    avg_usefulness = models.DecimalField(max_digits=3, decimal_places=2, default=Decimal("0.0"))
    ratings_count = models.PositiveIntegerField(default=0)

    class Meta:
        indexes = [
            models.Index(fields=["ratings_count"], name="course_ratings_count_idx"),
            models.Index(fields=["avg_difficulty"], name="course_avg_difficulty_idx"),
            models.Index(fields=["avg_usefulness"], name="course_avg_usefulness_idx"),
            models.Index(fields=["title"], name="course_title_idx"),
            GinIndex(
                name="course_title_trgm_idx",
                fields=["title"],
                opclasses=["gin_trgm_ops"],
            ),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["title", "department", "education_level"],
                name="course_identity_unique",
            ),
        ]

    def __str__(self):
        return f"{self.id} — {self.title}"

    def __repr__(self):
        return f"<{self.__class__.__name__} id={self.id} title={self.title}>"
