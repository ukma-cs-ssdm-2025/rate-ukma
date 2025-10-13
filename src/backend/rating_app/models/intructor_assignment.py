import uuid

from choices import InstructorRole
from django.db import models


class InstructorAssignment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    instructor = models.ForeignKey(
        "rating_app.Instructor", on_delete=models.CASCADE, related_name="assignments"
    )
    course_offering = models.ForeignKey(
        "rating_app.CourseOffering",
        on_delete=models.CASCADE,
        related_name="instructor_assignments",
    )
    role = models.TextChoices("InstructorRole", choices=InstructorRole)

    class Meta:
        unique_together = ("instructor", "course_offering", "role")

    def __str__(self):
        return f"{self.instructor} - {self.course_offering} ({self.role})"

    def __repr__(self):
        return f"{self.instructor} - {self.course_offering} ({self.role})"
