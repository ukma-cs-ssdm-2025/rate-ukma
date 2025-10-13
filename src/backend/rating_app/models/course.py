import uuid
from django.db import models
from django.db.models import Avg
from rating_app.models.choices import CourseTypeKind, CourseStatus

class Course(models.Model):

    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title        = models.CharField(max_length=255)
    description  = models.TextField(null=True, blank=True)
    status       = models.CharField(max_length=16, choices=CourseStatus.choices)

    department = models.ForeignKey(
        "rating_app.Department", on_delete=models.PROTECT, related_name="courses"
    )
    class Meta:
        managed = False

    def __str__(self):
        return f"{self.id} — {self.title}"

    def __repr__(self):
        return f"<Course id={self.id} title={self.title}>"

    @property
    def avg_difficulty(self):
        return self.ratings.aggregate(v=Avg('difficulty'))['v']

    @property
    def avg_usefulness(self):
        return self.ratings.aggregate(v=Avg('usefulness'))['v']

    @property
    def ratings_count(self):
        return self.ratings.count()