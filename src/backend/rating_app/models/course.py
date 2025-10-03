import reversion
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.db import models


def year_format_validator(value):
    if not (1000 <= value <= 9999):
        raise ValidationError(
            f"{value} is not a four-digit year",
            params={"value": value},
        )


@reversion.register()
class Course(models.Model):
    name = models.CharField(max_length=255)
    faculty = models.CharField(max_length=255)
    year = models.IntegerField(
        validators=[
            MinValueValidator(
                1991, message="Year cannot be earlier than 1991 (NaUKMA foundation)"
            ),
            year_format_validator,
        ]
    )
    ukma_id = models.CharField(max_length=6, unique=True)

    def __str__(self):
        return f"{self.name} ({self.ukma_id})"

    def __repr__(self):
        return f"{self.name} ({self.ukma_id})"

    class Meta:
        verbose_name = "Course"
        verbose_name_plural = "Courses"
