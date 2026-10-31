import uuid

from django.db import models

from .choices import PlanSlot, SemesterTerm
from .course_offering import CourseOffering
from .student import Student


class PlannedCourse(models.Model):
    student_id: uuid.UUID
    offering_id: uuid.UUID

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name="planned_courses")
    offering = models.ForeignKey(
        CourseOffering, on_delete=models.CASCADE, related_name="planned_by"
    )
    study_year = models.PositiveSmallIntegerField()
    term = models.CharField(max_length=8, choices=SemesterTerm.choices)
    slot = models.CharField(max_length=8, choices=PlanSlot.choices)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["student", "offering"],
                name="planned_course_student_offering_unique",
            ),
            models.CheckConstraint(
                condition=models.Q(study_year__gte=1),
                name="planned_course_study_year_gte_1",
            ),
        ]
        ordering = ["updated_at"]

    def __str__(self):
        return f"{self.student} → {self.offering} ({self.study_year} {self.term}, {self.slot})"
