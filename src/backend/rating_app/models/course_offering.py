import uuid

from django.core.validators import MaxLengthValidator, MinLengthValidator
from django.db import models
from django.db.models import Q

from .choices import EnrollmentStatus, ExamType, PracticeType
from .course import Course
from .instructor import Instructor
from .semester import Semester


class CourseOffering(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(
        max_length=6,
        unique=True,
        validators=[MinLengthValidator(6), MaxLengthValidator(6)],
    )
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="offerings")
    semester = models.ForeignKey(Semester, on_delete=models.PROTECT, related_name="offerings")

    credits = models.DecimalField(max_digits=3, decimal_places=1)
    weekly_hours = models.PositiveIntegerField()
    lecture_count = models.PositiveIntegerField(null=True, blank=True)
    practice_count = models.PositiveIntegerField(null=True, blank=True)
    practice_type = models.CharField(
        max_length=16, choices=PracticeType.choices, null=True, blank=True
    )
    exam_type = models.CharField(max_length=8, choices=ExamType.choices)
    max_students = models.PositiveIntegerField(null=True, blank=True)
    max_groups = models.PositiveIntegerField(null=True, blank=True)
    group_size_min = models.PositiveIntegerField(null=True, blank=True)
    group_size_max = models.PositiveIntegerField(null=True, blank=True)

    instructors = models.ManyToManyField(
        Instructor, through="CourseInstructor", related_name="course_offerings"
    )

    class Meta:
        ordering = ["-semester__year", "-semester__term", "course__title"]
        constraints = [
            models.CheckConstraint(
                check=Q(credits__gt=0),
                name="co_credits_gt_0",
            )
        ]

    def __str__(self):
        return f"{self.course.title} @ {self.semester}"

    def __repr__(self) -> str:
        return (
            f"<CourseOffering id={self.id} code={self.code} "
            f"name={self.course.title} semester={self.semester}>"
        )

    @property
    def occupied_seats(self) -> int:
        return self.enrollments.filter(status=EnrollmentStatus.ENROLLED).count()

    @property
    def free_seats(self):
        if self.max_students is None:
            return None
        return max(self.max_students - self.occupied_seats, 0)
