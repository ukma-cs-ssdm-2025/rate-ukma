from __future__ import annotations

from typing import TYPE_CHECKING

from django.apps import apps
from django.conf import settings
from django.db import models
from django.db.models.manager import Manager

from rating_app.models.choices import EducationLevel

from .person import Person

if TYPE_CHECKING:
    from .rating import Rating
    from .rating_vote import RatingVote


class Student(Person):
    ratings: Manager[Rating]
    rating_votes: Manager[RatingVote]

    education_level = models.CharField(
        max_length=16,
        choices=EducationLevel.choices,
        blank=True,
        default="",
    )
    email = models.EmailField(
        max_length=254,
        blank=True,
        default="",
        db_index=True,
    )
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="student_profile",
    )
    speciality = models.ForeignKey(
        "Speciality",
        on_delete=models.PROTECT,
        related_name="students",
    )

    class Meta(Person.Meta):
        abstract = False

    def __str__(self):
        return f"{self.first_name} {self.last_name} ({self.education_level})"

    def __repr__(self):
        return (
            f"<Student id={self.id} name={self.first_name} "
            f"last_name={self.last_name} education_level={self.education_level}>"
        )

    @property
    def overall_rated_courses(self) -> int:
        return self._rating_qs().values("course_offering__course").distinct().count()

    @property
    def rated_courses_this_sem(self) -> int:
        latest_sem = self._latest_semester()
        if not latest_sem:
            return 0
        return (
            self._rating_qs()
            .filter(course_offering__semester=latest_sem)
            .values("course_offering__course")
            .distinct()
            .count()
        )

    def _rating_qs(self):
        return self.ratings.all()

    def _latest_semester(self):
        Semester = apps.get_model("rating_app", "Semester")
        return Semester.objects.order_by("-year", "-term").first()
