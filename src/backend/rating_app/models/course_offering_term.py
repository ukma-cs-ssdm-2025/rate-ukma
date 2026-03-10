from __future__ import annotations

import uuid

from django.db import models
from django.db.models import Q

from .choices import ExamType, PracticeType
from .semester import Semester


class CourseOfferingTerm(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    offering = models.ForeignKey(
        "CourseOffering",
        on_delete=models.CASCADE,
        related_name="terms",
    )
    semester = models.ForeignKey(
        Semester,
        on_delete=models.PROTECT,
        related_name="course_offering_terms",
    )
    credits = models.DecimalField(max_digits=3, decimal_places=1)
    weekly_hours = models.PositiveIntegerField()
    lecture_count = models.PositiveIntegerField(null=True, blank=True)
    practice_count = models.PositiveIntegerField(null=True, blank=True)
    practice_type = models.CharField(
        max_length=16,
        choices=PracticeType.choices,
        blank=True,
        default="",
    )
    exam_type = models.CharField(max_length=8, choices=ExamType.choices)

    class Meta:
        constraints = [
            models.CheckConstraint(
                check=Q(credits__gt=0),
                name="cot_credits_gt_0",
            ),
            models.UniqueConstraint(
                fields=["offering", "semester"],
                name="cot_offering_semester_unique",
            ),
        ]
        ordering = ["semester__year", "semester__term"]

    def __str__(self) -> str:
        return f"{self.offering.course.title} @ {self.semester}"

    @property
    def total_hours(self) -> int | None:
        if self.credits is None:
            return None
        return int(self.credits * 30)
