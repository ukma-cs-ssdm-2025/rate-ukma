import uuid

from django.db import models

from .choices import EnrollmentStatus
from .course_offering import CourseOffering
from .student import Student


class Enrollment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name="enrollments")
    offering = models.ForeignKey(
        CourseOffering,
        on_delete=models.CASCADE,
        related_name="enrollments",
    )
    status = models.CharField(max_length=16, choices=EnrollmentStatus.choices)
    enrolled_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("student", "offering")
        indexes = [
            models.Index(fields=["student", "offering"]),
        ]

    def __str__(self):
        return f"{self.student} → {self.offering} ({self.get_status_display()})"

    def get_status_display(self):
        return EnrollmentStatus(self.status).label
