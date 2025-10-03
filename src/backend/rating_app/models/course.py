import reversion
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


@reversion.register()
class Course(models.Model):
    name = models.CharField(max_length=255)
    faculty = models.CharField(max_length=255)
    year = models.IntegerField(
        validators=[
            MinValueValidator(
                1991, message="Year cannot be earlier than 1991 (NaUKMA foundation)"
            ),
            MaxValueValidator(9999, message="Year is a 4-digit value"),
        ]
    )
    ukma_id = models.IntegerField(
        unique=True,
        validators=[
            MinValueValidator(100000, message="UKMA ID is a 6-digit value"),
            MaxValueValidator(999999, message="UKMA ID is a 6-digit value"),
        ],
    )

    def __str__(self):
        return f"{self.name} ({self.ukma_id})"

    def __repr__(self):
        return f"{self.name} ({self.ukma_id})"

    class Meta:
        verbose_name = "Course"
        verbose_name_plural = "Courses"
