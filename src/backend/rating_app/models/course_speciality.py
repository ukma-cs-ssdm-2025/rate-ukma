import uuid

from django.db import models

from .choices import CourseTypeKind


class CourseSpeciality(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    course = models.ForeignKey(
        "Course", on_delete=models.CASCADE, related_name="course_specialities"
    )
    speciality = models.ForeignKey(
        "Speciality", on_delete=models.CASCADE, related_name="course_specialities"
    )
    type_kind = models.CharField(
        max_length=16,
        choices=CourseTypeKind.choices,
    )

    def __str__(self):
        return f"{self.course} - {self.speciality} ({self.type_kind})"

    def __repr__(self):
        return f"<CourseSpeciality course={self.course} speciality={self.speciality} type_kind=({self.type_kind})>"

    class Meta:
        unique_together = ("course", "speciality")
