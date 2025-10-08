import uuid
from django.db import models
from django.core.validators import MinLengthValidator, MaxLengthValidator
from django.db.models import Avg
from rating_app.models.choices import CourseTypeKind, CourseStatus

class Course(models.Model):

    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code        = models.CharField(
                    max_length = 6,
                    unique=True,
                    validators=[MinLengthValidator(6), MaxLengthValidator(6)],
                )
    title       = models.CharField(max_length=255)
    description = models.TextField(null=True, blank=True)
    status      = models.CharField(max_length=16, choices=CourseStatus.choices)
    type_kind   = models.CharField(max_length=16, choices=CourseTypeKind.choices)

    faculty    = models.ForeignKey("rating_app.Faculty", on_delete=models.PROTECT, related_name="courses")
    department = models.ForeignKey("rating_app.Department", on_delete=models.PROTECT, related_name="courses")
    specialities = models.ManyToManyField("rating_app.Speciality", related_name="pro_oriented_courses", blank=True)

    class Meta:
        indexes = [models.Index(fields=["code"])]
        managed = False

    def __str__(self):
        return f"{self.code} — {self.title}"

    @property
    def avg_difficulty(self):
        return self.ratings.aggregate(v=Avg('difficulty'))['v']

    @property
    def avg_usefulness(self):
        return self.ratings.aggregate(v=Avg('usefulness'))['v']

    @property
    def ratings_count(self):
        return self.ratings.count()