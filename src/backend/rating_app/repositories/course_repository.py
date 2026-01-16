from typing import Any, overload

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import DataError
from django.db.models import Case, F, IntegerField, Prefetch, Q, QuerySet, Value, When

import structlog

from rateukma.protocols import IProcessor
from rating_app.application_schemas.course import (
    Course as CourseDTO,
)
from rating_app.application_schemas.course import (
    CourseFilterCriteria,
)
from rating_app.exception.course_exceptions import (
    CourseNotFoundError,
    InvalidCourseIdentifierError,
)
from rating_app.exception.department_exceptions import (
    DepartmentNotFoundError,
    InvalidDepartmentIdentifierError,
)
from rating_app.models import Course, CourseOffering, Department
from rating_app.models.choices import CourseStatus, SemesterTerm
from rating_app.pagination import GenericQuerysetPaginator, PaginationFilters, PaginationResult
from rating_app.repositories.protocol import IRepository

logger = structlog.get_logger(__name__)


class CourseRepository(IRepository[CourseDTO]):
    def __init__(
        self, mapper: IProcessor[[Course], CourseDTO], paginator: GenericQuerysetPaginator[Course]
    ):
        self._mapper = mapper
        self._paginator = paginator

    def get_all(self, prefetch_related: bool = True) -> list[CourseDTO]:
        courses = self._get_all_prefetch_related() if prefetch_related else self._get_all_shallow()
        return [self._mapper.process(course) for course in courses]

    def get_by_id(self, course_id: str, prefetch_related: bool = True) -> CourseDTO:
        course = (
            self._get_by_id_prefetch_related(course_id)
            if prefetch_related
            else self._get_by_id_shallow(course_id)
        )
        return self._mapper.process(course)

    @overload
    def filter(
        self,
        criteria: CourseFilterCriteria,
        pagination: PaginationFilters,
    ) -> PaginationResult[CourseDTO]: ...

    @overload
    def filter(
        self,
        criteria: CourseFilterCriteria,
    ) -> list[CourseDTO]: ...

    def filter(
        self,
        criteria: CourseFilterCriteria,
        pagination: PaginationFilters | None = None,
    ) -> PaginationResult[CourseDTO] | list[CourseDTO]:
        qs = self._filter(criteria)

        if pagination is not None:
            result = self._paginator.process(qs, pagination)
            dtos = [self._mapper.process(model) for model in result.page_objects]
            return PaginationResult(
                page_objects=dtos,
                metadata=result.metadata,
            )

        return self._map_to_domain_models(list(qs))

    def filter_qs(self, filters: CourseFilterCriteria) -> QuerySet[Course]:
        # filter() method can`t be overloaded with different parameters,
        # so we need a separate method for Paginator to use
        return self._filter(filters)

    def get_or_create(
        self,
        *,
        title: str,
        department_id: str,
        status: str = CourseStatus.PLANNED,
        description: str | None = None,
    ) -> tuple[CourseDTO, bool]:
        department = self._get_department_by_id(department_id)
        course, created = Course.objects.get_or_create(
            title=title,
            department=department,
            status=status,
            description=description,
        )
        return self._mapper.process(course), created

    def get_or_create_model(
        self,
        *,
        title: str,
        department_id: str,
        status: str = CourseStatus.PLANNED,
        description: str | None = None,
    ) -> tuple[Course, bool]:
        # we can`t effectively overload the method with different parameters,
        # so we need to create a new method
        # injector sets ORM M2M relations, so it needs an ORM model to be returned
        department = self._get_department_by_id(department_id)
        return Course.objects.get_or_create(
            title=title,
            department=department,
            status=status,
            description=description,
        )

    def update(self, course_dto: CourseDTO, **course_data) -> CourseDTO:
        course_orm = self._get_by_id_shallow(course_dto.id)
        for field, value in course_data.items():
            setattr(course_orm, field, value)
        course_orm.save()
        return self._mapper.process(course_orm)

    def delete(self, course_dto: CourseDTO) -> None:
        course_orm = self._get_by_id_shallow(course_dto.id)
        course_orm.delete()

    def _filter(self, filters: CourseFilterCriteria) -> QuerySet[Course]:
        courses = self._build_base_queryset()
        courses = self._apply_basic_filters(courses, filters)
        courses = self._apply_speciality_filters(courses, filters)
        courses = self._apply_range_filters(courses, filters)
        courses = self._apply_sorting(courses, filters)
        courses = courses.distinct()
        return courses

    def _build_base_queryset(self) -> QuerySet[Course]:
        return self._get_all_prefetch_related()

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

        # When sorting by average metrics, keep unrated courses last.
        has_ordering = filters.avg_difficulty_order or filters.avg_usefulness_order

        if has_ordering:
            has_ratings = Case(
                When(ratings_count__gt=0, then=Value(1)),
                default=Value(0),
                output_field=IntegerField(),
            )
            order_by_fields.append(has_ratings.desc())

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

    def _map_to_domain_models(self, models: list[Course]) -> list[CourseDTO]:
        return [self._mapper.process(model) for model in models]

    def _get_department_by_id(self, department_id: str) -> Department:
        try:
            return Department.objects.get(id=department_id)
        except Department.DoesNotExist as exc:
            logger.warning("department_not_found", department_id=department_id, error=str(exc))
            raise DepartmentNotFoundError(department_id) from exc
        except (ValueError, TypeError, DjangoValidationError, DataError) as exc:
            logger.warning(
                "invalid_department_identifier", department_id=department_id, error=str(exc)
            )
            raise InvalidDepartmentIdentifierError(department_id) from exc

    def _get_all_shallow(self) -> QuerySet[Course]:
        return Course.objects.select_related("department__faculty").all()

    def _get_all_prefetch_related(self) -> QuerySet[Course]:
        return (
            Course.objects.select_related("department__faculty")
            .prefetch_related(
                Prefetch(
                    "offerings",
                    queryset=CourseOffering.objects.select_related("semester").prefetch_related(
                        "instructors"
                    ),
                ),
                "course_specialities__speciality__faculty",
            )
            .all()
        )

    def _get_by_id_shallow(self, course_id: str) -> Course:
        try:
            return Course.objects.select_related("department__faculty").get(id=course_id)
        except Course.DoesNotExist as exc:
            logger.warning("course_not_found", course_id=course_id, error=str(exc))
            raise CourseNotFoundError(course_id) from exc
        except (ValueError, TypeError, DjangoValidationError, DataError) as exc:
            logger.warning("invalid_course_identifier", course_id=course_id, error=str(exc))
            raise InvalidCourseIdentifierError(course_id) from exc

    def _get_by_id_prefetch_related(self, course_id: str) -> Course:
        try:
            return (
                Course.objects.select_related("department__faculty")
                .prefetch_related(
                    Prefetch(
                        "offerings",
                        queryset=CourseOffering.objects.select_related("semester").prefetch_related(
                            "instructors"
                        ),
                    ),
                    "course_specialities__speciality__faculty",
                )
                .get(id=course_id)
            )
        except Course.DoesNotExist as exc:
            logger.warning("course_not_found", course_id=course_id, error=str(exc))
            raise CourseNotFoundError(course_id) from exc
        except (ValueError, TypeError, DjangoValidationError, DataError) as exc:
            logger.warning("invalid_course_identifier", course_id=course_id, error=str(exc))
            raise InvalidCourseIdentifierError(course_id) from exc
