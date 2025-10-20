from collections.abc import Sequence
from typing import TypeVar

from django.db import transaction

import structlog
from pydantic import BaseModel

from rateukma.protocols.decorators import implements
from rateukma.protocols.generic import IProvider
from rating_app.models import Course, Department, Speciality

from ...models.deduplicated import DeduplicatedCourse, EducationLevel

logger = structlog.get_logger(__name__)


_T = TypeVar("_T", bound=BaseModel, contravariant=True)


class IDbInjector(IProvider[[Sequence[_T]], None]):
    def provide(self, models: Sequence[_T]) -> None: ...


# is not a Provider, but an Operation by behavior
# currently it is a part of a Provider Chain, therefore implementing IProvider protocol
# can be adjusted in future


class CourseDbInjector(IDbInjector):
    @transaction.atomic
    @implements
    def provide(self, models: Sequence[DeduplicatedCourse]) -> None:
        for course_data in models:
            department = self._get_or_create_department(course_data.department, course_data.faculty)

            course = self._get_or_create_course(course_data.title, department)
            for spec_data in course_data.specialities:
                speciality = self._get_or_create_speciality(
                    spec_data.name,
                    spec_data.faculty,
                    spec_data.type.value if spec_data.type else EducationLevel.BACHELOR.value,
                )
                course.specialities.add(speciality)  # type: ignore

            logger.info(
                "course_injected",
                course_id=str(course.id),
                title=course.title,
                department=department.name,
                specialities_count=len(course_data.specialities),
            )

    def _get_or_create_department(self, department_name: str, faculty: str) -> Department:
        department, _ = Department.objects.get_or_create(name=department_name, faculty=faculty)  # type: ignore
        return department

    def _get_or_create_speciality(
        self, speciality_name: str, faculty: str, education_level: str
    ) -> Speciality:
        speciality, _ = Speciality.objects.get_or_create(  # type: ignore
            name=speciality_name, faculty=faculty, defaults={"education_level": education_level}
        )
        return speciality

    def _get_or_create_course(self, course_title: str, department: Department) -> Course:
        course, _ = Course.objects.get_or_create(title=course_title, department=department)  # type: ignore
        return course
