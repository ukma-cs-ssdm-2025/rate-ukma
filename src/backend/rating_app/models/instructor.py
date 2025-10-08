from django.db import models
from rating_app.models.choices import AcademicDegree, AcademicTitle
from .person import Person

class Instructor(Person):

    academic_degree      = models.CharField(max_length=8, choices=AcademicDegree.choices, null=True, blank=True)
    academic_title       = models.CharField(max_length=32, choices=AcademicTitle.choices, null=True, blank=True)
    is_lecturer          = models.BooleanField(default=False)
    is_practicum_teacher = models.BooleanField(default=False)
    
    class Meta:
        managed = False