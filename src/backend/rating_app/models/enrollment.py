from django.db import models
import uuid
from rating_app.models.choices import EnrollmentStatus

class Enrollment(models.Model):
    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student     = models.ForeignKey("rating_app.Student", on_delete=models.CASCADE, related_name="enrollments")
    course_offering    = models.ForeignKey("rating_app.CourseOffering", on_delete=models.CASCADE, related_name="enrollments")
    status      = models.CharField(max_length=16, choices=EnrollmentStatus.choices)
    enrolled_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("student", "course_offering")
        indexes = [
            models.Index(fields=["student", "course_offering"]),
        ]
        managed = False

    def __str__(self):
        return f"{self.student} → {self.course_offering} ({self.get_status_display()})"
