from django.db import models

from rating_app.models.choices import AcademicDegree, AcademicTitle

from .person import Person


class Instructor(Person):
    academic_degree = models.CharField(
        max_length=8, choices=AcademicDegree.choices, blank=True, default=""
    )
    academic_title = models.CharField(
        max_length=32, choices=AcademicTitle.choices, blank=True, default=""
    )

    class Meta(Person.Meta):
        abstract = False

    def __str__(self) -> str:
        return (
            f"{self.first_name} {self.last_name}. ({self.academic_degree}, {self.academic_title})"
        )

    def __repr__(self) -> str:
        return (
            f"<Instructor id={self.id} last_name={self.last_name} "
            f"first_name={self.first_name} degree={self.academic_degree} "
            f"title={self.academic_title}>"
        )
