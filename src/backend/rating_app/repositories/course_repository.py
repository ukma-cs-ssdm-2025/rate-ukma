from typing import Any

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import DataError
from django.db.models import F, Prefetch, Q, QuerySet

import structlog

from rating_app.application_schemas.course import (
    Course as CourseDTO,
)
from rating_app.application_schemas.course import (
    CourseFilterCriteria,
    CourseSpeciality,
)
from rating_app.exception.course_exceptions import (
    CourseNotFoundError,
    InvalidCourseIdentifierError,
)
from rating_app.models import Course, CourseOffering, Department
from rating_app.models.choices import CourseStatus, SemesterTerm
from rating_app.repositories.protocol import IRepository

logger = structlog.get_logger(__name__)


class CourseRepository(IRepository[CourseDTO]):
    def get_all(self) -> list[CourseDTO]:
        courses = (
            Course.objects.select_related("department__faculty")
            .prefetch_related(
                Prefetch("offerings", queryset=CourseOffering.objects.select_related("semester")),
                "course_specialities__speciality",
            )
            .all()
        )
        return [self._map_to_domain_model(course) for course in courses]

    def get_by_id(self, course_id: str) -> CourseDTO:
        try:
            course = (
                Course.objects.select_related("department__faculty")
                .prefetch_related(
                    Prefetch(
                        "offerings", queryset=CourseOffering.objects.select_related("semester")
                    ),
                    "course_specialities__speciality",
                )
                .get(id=course_id)
            )
            return self._map_to_domain_model(course)
        except Course.DoesNotExist as exc:
            logger.info("course_not_found", course_id=course_id)
            raise CourseNotFoundError(course_id) from exc
        except (ValueError, TypeError, DjangoValidationError, DataError) as exc:
            logger.warning("invalid_course_identifier", course_id=course_id, error=str(exc))
            raise InvalidCourseIdentifierError(course_id) from exc

    def filter(self, filters: CourseFilterCriteria) -> list[CourseDTO]:
        qs = self._filter_qs(filters)
        return self.map_to_domain_models(list(qs))

    def filter_qs(self, filters: CourseFilterCriteria) -> QuerySet[Course]:
        return self._filter_qs(filters)

    def get_or_create(
        self,
        *,
        title: str,
        department_id: str,
        status: str = CourseStatus.PLANNED,
        description: str | None = None,
    ) -> tuple[CourseDTO, bool]:
        department = Department.objects.get(id=department_id)
        course_orm, created = Course.objects.get_or_create(
            title=title,
            department=department,
            status=status,
            description=description,
        )
        course_dto = self._map_to_domain_model(course_orm)
        return course_dto, created

    def update(self, course_dto: CourseDTO, **course_data) -> CourseDTO:
        course_orm = Course.objects.get(id=course_dto.id)
        for field, value in course_data.items():
            setattr(course_orm, field, value)
        course_orm.save()
        return self._map_to_domain_model(course_orm)

    def delete(self, course_dto: CourseDTO) -> None:
        course_orm = Course.objects.get(id=course_dto.id)
        course_orm.delete()

    def _filter_qs(self, filters: CourseFilterCriteria) -> QuerySet[Course]:
        courses = self._build_base_queryset()
        courses = self._apply_basic_filters(courses, filters)
        courses = self._apply_speciality_filters(courses, filters)
        courses = self._apply_range_filters(courses, filters)
        courses = self._apply_sorting(courses, filters)
        courses = courses.distinct()
        return courses

    def _build_base_queryset(self) -> QuerySet[Course]:
        return (
            Course.objects.select_related("department__faculty")
            .prefetch_related(
                Prefetch(
                    "offerings",
                    queryset=CourseOffering.objects.select_related("semester").prefetch_related(
                        "instructors"
                    ),
                ),
                "course_specialities__speciality",
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
        if filters.ratings_count_min is not None:
            courses = courses.filter(ratings_count__gte=filters.ratings_count_min)
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

    def map_to_domain_models(self, models: list[Course]) -> list[CourseDTO]:
        return [self._map_to_domain_model(model) for model in models]

    def _map_to_domain_model(self, model: Course) -> CourseDTO:
        department = model.department
        department_id = str(department.id)
        faculty_obj = department.faculty if department else None
        faculty_id = str(faculty_obj.id) if faculty_obj else ""
        faculty_name = faculty_obj.name if faculty_obj else ""
        faculty_custom_abbreviation = faculty_obj.custom_abbreviation if faculty_obj else None
        status = model.status
        status = CourseStatus(status) if status in CourseStatus.values else CourseStatus.PLANNED
        specialities = self._parse_prefetched_course_specialities(model)

        return CourseDTO(
            id=str(model.id),
            title=model.title,
            description=model.description,
            status=status,
            department=department_id,
            department_name=department.name if department else "",
            faculty=faculty_id,
            faculty_name=faculty_name,
            faculty_custom_abbreviation=faculty_custom_abbreviation,
            specialities=specialities,
            avg_difficulty=model.avg_difficulty,
            avg_usefulness=model.avg_usefulness,
            ratings_count=model.ratings_count,
        )

    def _parse_prefetched_course_specialities(self, model: Course) -> list[CourseSpeciality]:
        from rating_app.application_schemas.course import CourseSpeciality

        prefetched_course_specialities = getattr(model, "_prefetched_objects_cache", {}).get(
            "course_specialities"
        )
        specialities: list[CourseSpeciality] = []

        if prefetched_course_specialities is None:
            return specialities

        for course_speciality in prefetched_course_specialities:
            speciality = getattr(course_speciality, "speciality", None)
            if speciality is None:
                continue

            faculty_obj = speciality.faculty
            faculty_id = str(faculty_obj.id) if faculty_obj else ""
            faculty_name = faculty_obj.name if faculty_obj else ""

            specialities.append(
                CourseSpeciality(
                    speciality_id=str(speciality.id),
                    speciality_title=speciality.name,
                    faculty_id=faculty_id,
                    faculty_name=faculty_name,
                    speciality_alias=speciality.alias,
                    type_kind=course_speciality.type_kind,
                )
            )
        return specialities
