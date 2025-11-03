from dataclasses import asdict, is_dataclass

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound
from rest_framework.response import Response

from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema

from rating_app.constants import (
    DEFAULT_COURSE_PAGE_SIZE,
    MAX_RATING_VALUE,
    MIN_RATING_VALUE,
)
from rating_app.filters.course_payload import CourseFilterPayload
from rating_app.models import Course
from rating_app.serializers import FilterOptionsSerializer
from rating_app.serializers.course.course_detail import CourseDetailSerializer
from rating_app.serializers.course.course_list import CourseListSerializer
from rating_app.services.course_service import CourseService
from rating_app.views.filters_parsers.course import CourseFilterParser, CourseQueryParams
from rating_app.views.responses import R_COURSE, R_COURSE_LIST, R_FILTER_OPTIONS


@extend_schema(tags=["courses"])
class CourseViewSet(viewsets.ViewSet):
    lookup_url_kwarg = "course_id"
    serializer_class = CourseListSerializer

    # IoC args
    course_service: CourseService | None = None
    course_filter_parser: CourseFilterParser | None = None

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
        assert self.course_service is not None
        assert self.course_filter_parser is not None

        query_filters: CourseQueryParams = self.course_filter_parser.parse(request.query_params)
        payload: CourseFilterPayload = self.course_service.filter_courses(**asdict(query_filters))

        page = payload.page or 1
        total_pages = payload.total_pages

        if not total_pages:
            total = payload.total
            size = payload.page_size

            if total is not None and size:
                total_pages = max((total + size - 1) // size, 1)
            else:
                total_pages = 1

        filters_dict = self._serialize_filters(payload)

        response_data = {
            "items": self.serializer_class(payload.items, many=True).data,
            "filters": filters_dict,
            "page": page,
            "page_size": payload.page_size,
            "total": payload.total,
            "total_pages": total_pages,
            "next_page": page + 1 if page < total_pages else None,
            "previous_page": page - 1 if page > 1 else None,
        }
        return Response(response_data, status=status.HTTP_200_OK)

    @extend_schema(
        summary="Get filter options for course listing",
        description="Retrieve available filter values.",
        responses=R_FILTER_OPTIONS,
    )
    @action(detail=False, methods=["get"], url_path="filter-options")
    def filter_options(self, request):
        assert self.course_service is not None

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
        assert self.course_service is not None

        try:
            course = self.course_service.get_course(course_id)
            serializer = CourseDetailSerializer(course)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except (Course.DoesNotExist, ValueError):
            raise NotFound(detail="Course not found") from None

    def _serialize_filters(self, filters_obj: CourseFilterPayload) -> dict:
        if filters_obj is None:
            return {}
        if is_dataclass(filters_obj):
            return asdict(filters_obj)
        if hasattr(filters_obj, "__dict__"):
            return filters_obj.__dict__
        return {}
