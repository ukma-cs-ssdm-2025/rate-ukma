from collections.abc import Sequence
from typing import TypeVar

from django.db import transaction

import structlog
from pydantic import BaseModel

from rateukma.protocols.decorators import implements
from rateukma.protocols.generic import IOperation
from rating_app.models import Course, Department, Faculty, Speciality

from ...models.deduplicated import DeduplicatedCourse, EducationLevel

logger = structlog.get_logger(__name__)


_T = TypeVar("_T", bound=BaseModel, contravariant=True)


class IDbInjector(IOperation[[Sequence[_T]]]):
    _is_protocol = True

    def execute(self, models: Sequence[_T]) -> None: ...


# TODO: refactor to use models repositories when they are available for reuse
class CourseDbInjector(IDbInjector):
    @transaction.atomic
    @implements
    def execute(self, models: Sequence[DeduplicatedCourse]) -> None:
        for course_data in models:
            faculty = self._get_or_create_faculty(course_data.faculty)
            department = self._get_or_create_department(course_data.department, faculty)

            course = self._get_or_create_course(course_data.title, department)
            for spec_data in course_data.specialities:
                speciality = self._get_or_create_speciality(
                    spec_data.name,
                    faculty,
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

    def _get_or_create_faculty(self, faculty_name: str) -> Faculty:
        faculty, _ = Faculty.objects.get_or_create(name=faculty_name)  # type: ignore
        return faculty

    def _get_or_create_department(self, department_name: str, faculty: Faculty) -> Department:
        department, _ = Department.objects.get_or_create(name=department_name, faculty=faculty)  # type: ignore
        return department

    def _get_or_create_speciality(
        self, speciality_name: str, faculty: Faculty, education_level: str
    ) -> Speciality:
        speciality, _ = Speciality.objects.get_or_create(  # type: ignore
            name=speciality_name, faculty=faculty
        )
        return speciality

    def _get_or_create_course(self, course_title: str, department: Department) -> Course:
        course, _ = Course.objects.get_or_create(title=course_title, department=department)  # type: ignore
        return course
