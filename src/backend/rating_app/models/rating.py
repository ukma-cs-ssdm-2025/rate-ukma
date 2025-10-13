import uuid

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models import Q


class Rating(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(
        "rating_app.Student", on_delete=models.CASCADE, related_name="ratings"
    )
    course_offering = models.ForeignKey(
        "rating_app.CourseOffering", on_delete=models.CASCADE, related_name="ratings"
    )
    difficulty = models.IntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)]
    )
    usefulness = models.IntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)]
    )
    comment = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    is_anonymous = models.BooleanField(default=False)

    class Meta:
        indexes = [
            models.Index(fields=["course_offering"]),
            models.Index(fields=["student", "course_offering"]),
        ]
        constraints = [
            models.CheckConstraint(
                check=Q(difficulty__gte=1, difficulty__lte=5),
                name="rating_difficulty_1_5",
            ),
            models.CheckConstraint(
                check=Q(usefulness__gte=1, usefulness__lte=5),
                name="rating_usefulness_1_5",
            ),
        ]
        managed = False

    def __str__(self):
        return f"Rating {self.difficulty}/{self.usefulness} by {self.student} on {self.course_offering}"

    def __repr__(self) -> str:
        return f"<Rating id={self.id} student={self.student} course_offering={self.course_offering} difficulty={self.difficulty} usefulness={self.usefulness}>"
