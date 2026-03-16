from typing import Any, Literal, overload

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import DataError, IntegrityError, transaction
from django.db.models import (
    Case,
    Exists,
    F,
    IntegerField,
    OuterRef,
    Prefetch,
    Q,
    QuerySet,
    Value,
    When,
)

import structlog

from rateukma.protocols import IProcessor
from rating_app.application_schemas.course import (
    Course as CourseDTO,
)
from rating_app.application_schemas.course import (
    CourseFilterCriteriaInternal,
    CourseInput,
)
from rating_app.exception.course_exceptions import (
    CourseNotFoundError,
    InvalidCourseIdentifierError,
)
from rating_app.exception.department_exceptions import (
    DepartmentNotFoundError,
    InvalidDepartmentIdentifierError,
)
from rating_app.models import Course, CourseOffering, CourseOfferingSpeciality, Department
from rating_app.models.choices import SemesterTerm
from rating_app.pagination import GenericQuerysetPaginator, PaginationFilters, PaginationResult
from rating_app.repositories.protocol import IPaginatedRepository

logger = structlog.get_logger(__name__)


class CourseRepository(
    IPaginatedRepository[CourseDTO, Course, CourseFilterCriteriaInternal, CourseDTO]
):
    def __init__(
        self, mapper: IProcessor[[Course], CourseDTO], paginator: GenericQuerysetPaginator[Course]
    ):
        self._mapper = mapper
        self._paginator = paginator

    def get_all(self, prefetch_related: bool = True) -> list[CourseDTO]:
        courses = self._get_all_prefetch_related() if prefetch_related else self._get_all_shallow()
        return [self._mapper.process(course) for course in courses]

    def get_by_id(self, id: str, prefetch_related: bool = True) -> CourseDTO:
        course = (
            self._get_by_id_prefetch_related(id)
            if prefetch_related
            else self._get_by_id_shallow(id)
        )
        return self._mapper.process(course)

    @overload
    def filter(
        self,
        criteria: CourseFilterCriteriaInternal,
        pagination: PaginationFilters,
    ) -> PaginationResult[CourseDTO]: ...

    @overload
    def filter(
        self,
        criteria: CourseFilterCriteriaInternal,
        pagination: None = ...,
    ) -> list[CourseDTO]: ...

    def filter(
        self,
        criteria: CourseFilterCriteriaInternal,
        pagination: PaginationFilters | None = None,
        *,
        prefetch_related: bool = True,
    ) -> PaginationResult[CourseDTO] | list[CourseDTO]:
        qs = self._filter(criteria, prefetch_related=prefetch_related)

        if pagination is not None:
            result = self._paginator.process(qs, pagination)
            dtos = [self._mapper.process(model) for model in result.page_objects]
            return PaginationResult(
                page_objects=dtos,
                metadata=result.metadata,
            )

        return self._map_to_domain_models(list(qs))

    @overload
    def get_or_create(
        self,
        data: CourseInput | CourseDTO,
        *,
        return_model: Literal[False] = ...,
    ) -> tuple[CourseDTO, bool]: ...

    @overload
    def get_or_create(
        self,
        data: CourseInput | CourseDTO,
        *,
        return_model: Literal[True],
    ) -> tuple[Course, bool]: ...

    def get_or_create(
        self,
        data: CourseInput | CourseDTO,
        *,
        return_model: bool = False,
    ) -> tuple[CourseDTO, bool] | tuple[Course, bool]:
        department = self._get_department_by_id(data.department)
        course, created = self._get_or_create_by_identity(
            data=data,
            department=department,
            update_existing=False,
        )

        if return_model:
            return course, created
        return self._mapper.process(course), created

    @overload
    def get_or_upsert(
        self,
        data: CourseInput | CourseDTO,
        *,
        return_model: Literal[False] = ...,
    ) -> tuple[CourseDTO, bool]: ...

    @overload
    def get_or_upsert(
        self,
        data: CourseInput | CourseDTO,
        *,
        return_model: Literal[True],
    ) -> tuple[Course, bool]: ...

    def get_or_upsert(
        self,
        data: CourseInput | CourseDTO,
        *,
        return_model: bool = False,
    ) -> tuple[CourseDTO, bool] | tuple[Course, bool]:
        department = self._get_department_by_id(data.department)
        course, created = self._get_or_create_by_identity(
            data=data,
            department=department,
            update_existing=True,
        )

        if return_model:
            return course, created
        return self._mapper.process(course), created

    def update(self, obj: CourseDTO, **course_data: object) -> CourseDTO:
        course_orm = self._get_by_id_shallow(str(obj.id))
        for field, value in course_data.items():
            setattr(course_orm, field, value)
        course_orm.save()
        return self._mapper.process(course_orm)

    def delete(self, id: str) -> None:
        course_orm = self._get_by_id_shallow(id)
        course_orm.delete()

    def _filter(
        self, filters: CourseFilterCriteriaInternal, *, prefetch_related: bool = True
    ) -> QuerySet[Course]:
        courses = self._build_base_queryset(prefetch_related=prefetch_related)
        courses = self._apply_basic_filters(courses, filters)
        courses = self._apply_speciality_filters(courses, filters)
        courses = self._apply_range_filters(courses, filters)
        courses = self._apply_sorting(courses, filters)
        return courses

    def _get_or_create_by_identity(
        self,
        *,
        data: CourseInput | CourseDTO,
        department: Department,
        update_existing: bool,
    ) -> tuple[Course, bool]:
        normalized_level = data.education_level or ""
        course = Course.objects.filter(
            title=data.title,
            department=department,
            education_level=normalized_level,
        ).first()
        created = False

        if course is None and normalized_level and update_existing:
            course = Course.objects.filter(
                title=data.title,
                department=department,
                education_level="",
            ).first()

        if course is None:
            try:
                with transaction.atomic():
                    course = Course.objects.create(
                        title=data.title,
                        department=department,
                        education_level=normalized_level,
                        status=data.status,
                        description=data.description,
                    )
                    created = True
            except IntegrityError:
                course = Course.objects.filter(
                    title=data.title,
                    department=department,
                    education_level=normalized_level,
                ).first()
                if course is None:
                    raise
        elif update_existing:
            updated_fields = self._collect_updated_fields(course=course, data=data)
            if updated_fields:
                course.save(update_fields=updated_fields)

        return course, created

    def _collect_updated_fields(
        self,
        *,
        course: Course,
        data: CourseInput | CourseDTO,
    ) -> list[str]:
        updated_fields: list[str] = []

        normalized_level = data.education_level or ""
        for field, new_value in (
            ("education_level", normalized_level),
            ("status", data.status),
            ("description", data.description),
        ):
            if getattr(course, field) != new_value:
                setattr(course, field, new_value)
                updated_fields.append(field)

        return updated_fields

    def _build_base_queryset(self, *, prefetch_related: bool = True) -> QuerySet[Course]:
        if prefetch_related:
            return self._get_all_prefetch_related()
        return self._get_all_shallow()

    def _apply_basic_filters(
        self, courses: QuerySet[Course], filters: CourseFilterCriteriaInternal
    ) -> QuerySet[Course]:
        # TODO: research if reflection can be applied here

        course_filters: dict[str, Any] = {}
        offering_query = self._build_offering_filter_queryset(filters)

        if filters.name:
            course_filters["title__icontains"] = filters.name

        if filters.faculty:
            course_filters["department__faculty_id"] = filters.faculty

        if filters.department:
            course_filters["department_id"] = filters.department

        if course_filters:
            courses = courses.filter(**course_filters)
        if offering_query is not None:
            courses = courses.filter(Exists(offering_query))

        return courses

    def _build_offering_filter_queryset(
        self, filters: CourseFilterCriteriaInternal
    ) -> QuerySet[CourseOffering] | None:
        offering_query = CourseOffering.objects.filter(course_id=OuterRef("pk"))
        has_offering_filter = False

        if filters.semester_year:
            academic_year_q = self._build_academic_year_q(filters.semester_year)
            if academic_year_q is not None:
                offering_query = offering_query.filter(academic_year_q)
                has_offering_filter = True

        if filters.semester_terms:
            offering_query = offering_query.filter(semester__term__in=filters.semester_terms)
            has_offering_filter = True

        if filters.instructor:
            offering_query = offering_query.filter(instructors__id=filters.instructor)
            has_offering_filter = True

        if filters.credits_min is not None:
            offering_query = offering_query.filter(credits__gte=filters.credits_min)
            has_offering_filter = True

        if filters.credits_max is not None:
            offering_query = offering_query.filter(credits__lte=filters.credits_max)
            has_offering_filter = True

        if not has_offering_filter:
            return None

        return offering_query

    def _build_academic_year_q(self, academic_year: str) -> Q | None:
        parsed = self._parse_academic_year(academic_year)
        if not parsed:
            return None

        start_year, end_year = parsed
        return (
            Q(semester__year=start_year, semester__term=SemesterTerm.FALL)
            | Q(
                semester__year=end_year,
                semester__term__in=[SemesterTerm.SPRING, SemesterTerm.SUMMER],
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

    def _apply_speciality_filters(self, courses, filters):
        if filters.type_kind:
            courses = courses.filter(
                Exists(
                    CourseOfferingSpeciality.objects.filter(
                        offering__course_id=OuterRef("pk"),
                        speciality_id=filters.speciality,
                        type_kind=filters.type_kind,
                    )
                )
            )

        if filters.exclude_type_kinds and filters.speciality:
            courses = courses.exclude(
                Exists(
                    CourseOfferingSpeciality.objects.filter(
                        offering__course_id=OuterRef("pk"),
                        speciality_id=filters.speciality,
                        type_kind__in=filters.exclude_type_kinds,
                    )
                )
            )

        if filters.speciality and not filters.type_kind and not filters.exclude_type_kinds:
            courses = courses.filter(
                Exists(
                    CourseOfferingSpeciality.objects.filter(
                        offering__course_id=OuterRef("pk"),
                        speciality_id=filters.speciality,
                    )
                )
            )

        return courses

    def _apply_range_filters(
        self, courses: QuerySet[Course], filters: CourseFilterCriteriaInternal
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
        self, courses: QuerySet[Course], filters: CourseFilterCriteriaInternal
    ) -> QuerySet[Course]:
        order_by_fields = self._build_order_by_fields(filters)

        courses = courses.annotate(
            has_ratings=Case(
                When(ratings_count__gt=0, then=Value(1)),
                default=Value(0),
                output_field=IntegerField(),
            )
        )

        if order_by_fields:
            return courses.order_by("-has_ratings", *order_by_fields, "title")
        return courses.order_by("-has_ratings", "-ratings_count", "title")

    def _build_order_by_fields(self, filters: CourseFilterCriteriaInternal) -> list[Any]:
        order_by_fields = []
        if filters.avg_difficulty_order:
            field = F("avg_difficulty")
            if filters.avg_difficulty_order == "asc":
                order_by_fields.append(field.asc())
            else:
                order_by_fields.append(field.desc())
        if filters.avg_usefulness_order:
            field = F("avg_usefulness")
            if filters.avg_usefulness_order == "asc":
                order_by_fields.append(field.asc())
            else:
                order_by_fields.append(field.desc())
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
                    queryset=CourseOffering.objects.prefetch_related(
                        Prefetch(
                            "course_offering_specialities",
                            queryset=CourseOfferingSpeciality.objects.select_related(
                                "speciality__faculty"
                            ),
                        ),
                    ),
                ),
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
                        queryset=CourseOffering.objects.prefetch_related(
                            Prefetch(
                                "course_offering_specialities",
                                queryset=CourseOfferingSpeciality.objects.select_related(
                                    "speciality__faculty"
                                ),
                            ),
                        ),
                    ),
                )
                .get(id=course_id)
            )
        except Course.DoesNotExist as exc:
            logger.warning("course_not_found", course_id=course_id, error=str(exc))
            raise CourseNotFoundError(course_id) from exc
        except (ValueError, TypeError, DjangoValidationError, DataError) as exc:
            logger.warning("invalid_course_identifier", course_id=course_id, error=str(exc))
            raise InvalidCourseIdentifierError(course_id) from exc
