from dataclasses import asdict, is_dataclass

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.response import Response

from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema

from rating_app.constants import (
    DEFAULT_COURSE_PAGE_SIZE,
    DEFAULT_PAGE_NUMBER,
    MAX_RATING_VALUE,
    MIN_RATING_VALUE,
)
from rating_app.ioc_container.services import course_service
from rating_app.models import Course
from rating_app.models.choices import SemesterTerm
from rating_app.serializers import FilterOptionsSerializer
from rating_app.serializers.course.course_detail import CourseDetailSerializer
from rating_app.serializers.course.course_list import CourseListSerializer
from rating_app.views.responses import R_COURSE, R_COURSE_LIST, R_FILTER_OPTIONS


@extend_schema(tags=["courses"])
class CourseViewSet(viewsets.ViewSet):
    lookup_url_kwarg = "course_id"
    serializer_class = CourseListSerializer

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.course_service = course_service()

    def _to_int(self, value: str | None, default: int) -> int:
        if value is None:
            return default
        try:
            return int(value)
        except (ValueError, TypeError):
            return default

    def _to_bool(self, value: str | None) -> bool | None:
        if value is None:
            return None
        return value.lower() in ["true", "1", "yes"]

    def _parse_rating_value(self, param: str, raw_value: str | None) -> float | None:
        if raw_value is None:
            return None
        try:
            value = float(raw_value)
        except (TypeError, ValueError):
            raise ValidationError({param: ["Invalid value"]}) from None

        if not (MIN_RATING_VALUE <= value <= MAX_RATING_VALUE):
            raise ValidationError({param: ["Value out of range"]})
        return value

    @extend_schema(
        summary="List courses",
        description="List courses with optional filters and pagination. "
        "Returns courses with aggregated ratings.",
        parameters=[
            OpenApiParameter(
                name="name",
                type=OpenApiTypes.STR,
                location=OpenApiParameter.QUERY,
                description="Filter courses by name (case-insensitive partial match)",
                required=False,
            ),
            OpenApiParameter(
                name="typeKind",
                type=OpenApiTypes.STR,
                location=OpenApiParameter.QUERY,
                description="Filter by course type (COMPULSORY, ELECTIVE, PROF_ORIENTED)",
                required=False,
            ),
            OpenApiParameter(
                name="instructor",
                type=OpenApiTypes.UUID,
                location=OpenApiParameter.QUERY,
                description="Filter by instructor ID",
                required=False,
            ),
            OpenApiParameter(
                name="faculty",
                type=OpenApiTypes.UUID,
                location=OpenApiParameter.QUERY,
                description="Filter by faculty ID",
                required=False,
            ),
            OpenApiParameter(
                name="department",
                type=OpenApiTypes.UUID,
                location=OpenApiParameter.QUERY,
                description="Filter by department ID",
                required=False,
            ),
            OpenApiParameter(
                name="speciality",
                type=OpenApiTypes.UUID,
                location=OpenApiParameter.QUERY,
                description="Filter by speciality ID",
                required=False,
            ),
            OpenApiParameter(
                name="semesterYear",
                type=OpenApiTypes.INT,
                location=OpenApiParameter.QUERY,
                description="Filter by semester year",
                required=False,
            ),
            OpenApiParameter(
                name="semesterTerm",
                type=OpenApiTypes.STR,
                location=OpenApiParameter.QUERY,
                description="Filter by semester term (FALL, SPRING, SUMMER)",
                required=False,
            ),
            OpenApiParameter(
                name="avg_difficulty_order",
                type=OpenApiTypes.STR,
                location=OpenApiParameter.QUERY,
                description="Sort by average difficulty (values: 'asc' or 'desc')",
                enum=["asc", "desc"],
                required=False,
            ),
            OpenApiParameter(
                name="avg_usefulness_order",
                type=OpenApiTypes.STR,
                location=OpenApiParameter.QUERY,
                description="Sort by average usefulness (values: 'asc' or 'desc')",
                enum=["asc", "desc"],
                required=False,
            ),
            OpenApiParameter(
                name="avg_difficulty_min",
                type=OpenApiTypes.FLOAT,
                location=OpenApiParameter.QUERY,
                description=f"Minimum average difficulty ({MIN_RATING_VALUE}-{MAX_RATING_VALUE})",
                required=False,
            ),
            OpenApiParameter(
                name="avg_difficulty_max",
                type=OpenApiTypes.FLOAT,
                location=OpenApiParameter.QUERY,
                description=f"Maximum average difficulty ({MIN_RATING_VALUE}-{MAX_RATING_VALUE})",
                required=False,
            ),
            OpenApiParameter(
                name="avg_usefulness_min",
                type=OpenApiTypes.FLOAT,
                location=OpenApiParameter.QUERY,
                description=f"Minimum average usefulness ({MIN_RATING_VALUE}-{MAX_RATING_VALUE})",
                required=False,
            ),
            OpenApiParameter(
                name="avg_usefulness_max",
                type=OpenApiTypes.FLOAT,
                location=OpenApiParameter.QUERY,
                description=f"Maximum average usefulness ({MIN_RATING_VALUE}-{MAX_RATING_VALUE})",
                required=False,
            ),
            OpenApiParameter(
                name="page",
                type=OpenApiTypes.INT,
                location=OpenApiParameter.QUERY,
                description="Page number (default: 1)",
                required=False,
            ),
            OpenApiParameter(
                name="page_size",
                type=OpenApiTypes.INT,
                location=OpenApiParameter.QUERY,
                description=f"Items per page (default: {DEFAULT_COURSE_PAGE_SIZE})",
                required=False,
            ),
        ],
        responses=R_COURSE_LIST,
    )
    def list(self, request, *args, **kwargs):
        page = self._to_int(request.query_params.get("page"), DEFAULT_PAGE_NUMBER)
        page_size = self._to_int(request.query_params.get("page_size"), DEFAULT_COURSE_PAGE_SIZE)

        semester_year_raw = request.query_params.get("semesterYear")
        semester_year = None
        if semester_year_raw:
            try:
                semester_year = int(semester_year_raw)
            except (ValueError, TypeError):
                raise ValidationError({"semesterYear": ["Invalid value"]}) from None
            if semester_year < 1991:
                raise ValidationError({"semesterYear": ["Value out of range"]})

        semester_term_raw = request.query_params.get("semesterTerm")
        semester_term = None
        if semester_term_raw:
            normalized_term = semester_term_raw.upper()
            if normalized_term in SemesterTerm.values:
                semester_term = normalized_term
            else:
                raise ValidationError({"semesterTerm": ["Invalid value"]})

        # Handle order parameters
        avg_difficulty_order = request.query_params.get("avg_difficulty_order")
        avg_usefulness_order = request.query_params.get("avg_usefulness_order")

        # Range filters for ratings
        avg_difficulty_min = self._parse_rating_value(
            "avg_difficulty_min", request.query_params.get("avg_difficulty_min")
        )
        avg_difficulty_max = self._parse_rating_value(
            "avg_difficulty_max", request.query_params.get("avg_difficulty_max")
        )
        if (
            avg_difficulty_min is not None
            and avg_difficulty_max is not None
            and avg_difficulty_min > avg_difficulty_max
        ):
            raise ValidationError(
                {
                    "avg_difficulty_min": ["Must be less than or equal to avg_difficulty_max"],
                    "avg_difficulty_max": ["Must be greater than or equal to avg_difficulty_min"],
                }
            )

        avg_usefulness_min = self._parse_rating_value(
            "avg_usefulness_min", request.query_params.get("avg_usefulness_min")
        )
        avg_usefulness_max = self._parse_rating_value(
            "avg_usefulness_max", request.query_params.get("avg_usefulness_max")
        )
        if (
            avg_usefulness_min is not None
            and avg_usefulness_max is not None
            and avg_usefulness_min > avg_usefulness_max
        ):
            raise ValidationError(
                {
                    "avg_usefulness_min": ["Must be less than or equal to avg_usefulness_max"],
                    "avg_usefulness_max": ["Must be greater than or equal to avg_usefulness_min"],
                }
            )

        result = self.course_service.filter_courses(
            name=request.query_params.get("name"),
            type_kind=request.query_params.get("typeKind"),
            instructor=request.query_params.get("instructor"),
            faculty=request.query_params.get("faculty"),
            department=request.query_params.get("department"),
            speciality=request.query_params.get("speciality"),
            semester_year=semester_year,
            semester_term=semester_term,
            avg_difficulty_min=avg_difficulty_min,
            avg_difficulty_max=avg_difficulty_max,
            avg_usefulness_min=avg_usefulness_min,
            avg_usefulness_max=avg_usefulness_max,
            avg_difficulty_order=avg_difficulty_order,
            avg_usefulness_order=avg_usefulness_order,
            page_size=page_size,
            page=page,
        )

        page = result.page or 1
        total_pages = getattr(result, "total_pages", None)
        if not total_pages:
            total = getattr(result, "total", None)
            size = getattr(result, "page_size", None) or page_size
            if total is not None and size:
                total_pages = max((total + size - 1) // size, 1)
            else:
                total_pages = 1

        filters_dict = {}
        if result.filters is not None:
            if is_dataclass(result.filters):
                filters_dict = asdict(result.filters)
            elif hasattr(result.filters, "__dict__"):
                filters_dict = result.filters.__dict__

        response_data = {
            "items": self.serializer_class(result.items, many=True).data,
            "filters": filters_dict,
            "page": page,
            "page_size": result.page_size,
            "total": result.total,
            "total_pages": total_pages,
            "next": page + 1 if page < total_pages else None,
            "previous": page - 1 if page > 1 else None,
        }
        return Response(response_data, status=status.HTTP_200_OK)

    @extend_schema(
        summary="Get filter options for course listing",
        description="Retrieve available filter values.",
        responses=R_FILTER_OPTIONS,
    )
    @action(detail=False, methods=["get"], url_path="filter-options")
    def filter_options(self, request):
        filter_options = self.course_service.get_filter_options()

        serializer = FilterOptionsSerializer(filter_options)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @extend_schema(
        summary="Retrieve a course",
        description="Retrieve a single course by its ID with detailed information.",
        parameters=[
            OpenApiParameter(
                name="course_id",
                type=OpenApiTypes.UUID,
                location=OpenApiParameter.PATH,
                description="A unique identifier for the course.",
            )
        ],
        responses=R_COURSE,
    )
    def retrieve(self, request, course_id=None, *args, **kwargs):
        try:
            course = self.course_service.get_course(course_id)
            serializer = CourseDetailSerializer(course)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except (Course.DoesNotExist, ValueError):
            raise NotFound(detail="Course not found") from None
