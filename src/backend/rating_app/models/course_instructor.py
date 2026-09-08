import uuid

from django.db import models

from .choices import InstructorRole


class CourseInstructor(models.Model):
    # NOTE: prod-empty — only generate_mock_data.py creates rows; the scraper
    # injector never populates this table, so instructor filters match nothing
    # in prod (see #664). Follow-up proposes removal: #687.
    instructor_id: uuid.UUID
    course_offering_id: uuid.UUID

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    instructor = models.ForeignKey(
        "rating_app.Instructor", on_delete=models.CASCADE, related_name="assignments"
    )
    course_offering = models.ForeignKey(
        "rating_app.CourseOffering",
        on_delete=models.CASCADE,
        related_name="instructor_assignments",
    )
    role = models.CharField(max_length=20, choices=InstructorRole.choices, null=False)

    class Meta:
        unique_together = ("instructor", "course_offering", "role")

    def __str__(self):
        return f"{self.instructor} - {self.course_offering} ({self.role})"

    def __repr__(self):
        return f"{self.instructor} - {self.course_offering} ({self.role})"
