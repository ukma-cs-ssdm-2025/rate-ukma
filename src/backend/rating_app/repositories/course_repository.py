from typing import Any

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import DataError
from django.db.models import F, Q, QuerySet

import structlog

from rating_app.application_schemas.course import CourseFilterCriteria
from rating_app.exception.course_exceptions import (
    CourseNotFoundError,
    InvalidCourseIdentifierError,
)
from rating_app.models import Course, Department
from rating_app.models.choices import CourseStatus, SemesterTerm
from rating_app.repositories.protocol import IRepository

logger = structlog.get_logger(__name__)

logger = structlog.get_logger()


class CourseRepository(IRepository[Course]):
    def get_all(self) -> list[Course]:
        return list(
            Course.objects.select_related("department__faculty")
            .prefetch_related("offerings__semester", "course_specialities__speciality")
            .all()
        )

    def get_by_id(self, course_id: str) -> Course:
        try:
            return (
                Course.objects.select_related("department__faculty")
                .prefetch_related("offerings__semester", "course_specialities__speciality")
                .get(id=course_id)
            )
        except Course.DoesNotExist as exc:
            logger.info("course_not_found", course_id=course_id)
            raise CourseNotFoundError(course_id) from exc
        except (ValueError, TypeError, DjangoValidationError, DataError) as exc:
            logger.warning("invalid_course_identifier", course_id=course_id, error=str(exc))
            raise InvalidCourseIdentifierError(course_id) from exc

    def filter(self, filters: CourseFilterCriteria) -> QuerySet[Course]:
        courses = self._build_base_queryset()
        courses = self._apply_basic_filters(courses, filters)
        courses = self._apply_speciality_filters(courses, filters)
        courses = self._apply_range_filters(courses, filters)
        courses = self._apply_sorting(courses, filters)
        courses = courses.distinct()
        return courses

    def get_or_create(
        self,
        *,
        title: str,
        department: Department,
        status: str = CourseStatus.PLANNED,
        description: str | None = None,
    ) -> tuple[Course, bool]:
        return Course.objects.get_or_create(
            title=title,
            department=department,
            status=status,
            description=description,
        )

    def update(self, course: Course, **course_data) -> Course:
        for field, value in course_data.items():
            setattr(course, field, value)
        course.save()
        return course

    def delete(self, course: Course) -> None:
        course.delete()

    def _build_base_queryset(self) -> QuerySet[Course]:
        return (
            Course.objects.select_related("department__faculty")
            .prefetch_related(
                "course_specialities__speciality",
                "offerings__semester",
                "offerings__instructors",
            )
            .all()
        )

    def _apply_basic_filters(
        self, courses: QuerySet[Course], filters: CourseFilterCriteria
    ) -> QuerySet[Course]:
        # TODO: research if reflection can be applied here

        q_filters: dict[str, Any] = {}

        if filters.name:
            q_filters["title__icontains"] = filters.name

        if filters.faculty:
            q_filters["department__faculty_id"] = filters.faculty

        if filters.department:
            q_filters["department_id"] = filters.department

        if filters.semester_year:
            courses = self._apply_academic_year_filter(courses, filters.semester_year)

        if filters.semester_term:
            q_filters["offerings__semester__term"] = filters.semester_term

        if filters.instructor:
            q_filters["offerings__instructors__id"] = filters.instructor

        return courses.filter(**q_filters) if q_filters else courses

    def _apply_academic_year_filter(
        self, courses: QuerySet[Course], academic_year: str
    ) -> QuerySet[Course]:
        parsed = self._parse_academic_year(academic_year)
        if not parsed:
            return courses

        start_year, end_year = parsed
        return courses.filter(
            Q(offerings__semester__year=start_year, offerings__semester__term=SemesterTerm.FALL)
            | Q(
                offerings__semester__year=end_year,
                offerings__semester__term__in=[SemesterTerm.SPRING, SemesterTerm.SUMMER],
            )
        )

    def _parse_academic_year(self, academic_year: str) -> tuple[int, int] | None:
        try:
            separator = "–" if "–" in academic_year else "-"
            parts = academic_year.split(separator)
            if len(parts) != 2:
                return None
            start_year = int(parts[0].strip())
            end_year = int(parts[1].strip())
            if end_year != start_year + 1:
                return None
            return (start_year, end_year)
        except (ValueError, AttributeError):
            return None

    def _apply_speciality_filters(
        self, courses: QuerySet[Course], filters: CourseFilterCriteria
    ) -> QuerySet[Course]:
        if filters.type_kind:
            courses = courses.filter(course_specialities__type_kind=filters.type_kind)
        if filters.speciality:
            courses = courses.filter(course_specialities__speciality_id=filters.speciality)
        return courses

    def _apply_range_filters(
        self, courses: QuerySet[Course], filters: CourseFilterCriteria
    ) -> QuerySet[Course]:
        if filters.avg_difficulty_min is not None:
            courses = courses.filter(avg_difficulty__gte=filters.avg_difficulty_min)
        if filters.avg_difficulty_max is not None:
            courses = courses.filter(avg_difficulty__lte=filters.avg_difficulty_max)
        if filters.avg_usefulness_min is not None:
            courses = courses.filter(avg_usefulness__gte=filters.avg_usefulness_min)
        if filters.avg_usefulness_max is not None:
            courses = courses.filter(avg_usefulness__lte=filters.avg_usefulness_max)
        return courses

    def _apply_sorting(
        self, courses: QuerySet[Course], filters: CourseFilterCriteria
    ) -> QuerySet[Course]:
        order_by_fields = self._build_order_by_fields(filters)

        if order_by_fields:
            return courses.order_by(*order_by_fields, "title")
        return courses.order_by("-ratings_count", "title")

    def _build_order_by_fields(self, filters: CourseFilterCriteria) -> list[Any]:
        order_by_fields = []
        if filters.avg_difficulty_order:
            field = F("avg_difficulty")
            if filters.avg_difficulty_order == "asc":
                order_by_fields.append(field.asc(nulls_last=True))
            else:
                order_by_fields.append(field.desc(nulls_last=True))
        if filters.avg_usefulness_order:
            field = F("avg_usefulness")
            if filters.avg_usefulness_order == "asc":
                order_by_fields.append(field.asc(nulls_last=True))
            else:
                order_by_fields.append(field.desc(nulls_last=True))
        return order_by_fields
