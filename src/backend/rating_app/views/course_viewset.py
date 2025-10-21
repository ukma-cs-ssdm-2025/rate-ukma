from rest_framework import status, viewsets
from rest_framework.exceptions import NotFound
from rest_framework.response import Response

from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema

from rating_app.models import Course
from rating_app.repositories.course_repository import CourseRepository
from rating_app.services.course_service import CourseService

from ..serializers.course.course_detail import CourseDetailSerializer
from ..serializers.course.course_list import CourseListSerializer
from .responses import R_COURSE, R_COURSE_LIST


@extend_schema(tags=["courses"])
class CourseViewSet(viewsets.ViewSet):
    lookup_url_kwarg = "course_id"
    serializer_class = CourseListSerializer

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.course_service = CourseService(CourseRepository())

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
                description="Items per page (default: 10)",
                required=False,
            ),
        ],
        responses=R_COURSE_LIST,
    )
    def list(self, request, *args, **kwargs):
        page = self._to_int(request.query_params.get("page"), 1)
        page_size = self._to_int(request.query_params.get("page_size"), 10)

        # Handle order parameters
        avg_difficulty_order = request.query_params.get("avg_difficulty_order")
        avg_usefulness_order = request.query_params.get("avg_usefulness_order")

        result = self.course_service.filter_courses(
            page=page,
            page_size=page_size,
            name=request.query_params.get("name"),
            type_kind=request.query_params.get("typeKind"),
            instructor=request.query_params.get("instructor"),
            faculty=request.query_params.get("faculty"),
            department=request.query_params.get("department"),
            speciality=request.query_params.get("speciality"),
            avg_difficulty_order=avg_difficulty_order,
            avg_usefulness_order=avg_usefulness_order,
        )

        page = result["page"]
        total_pages = result["total_pages"]

        response_data = {
            "results": self.serializer_class(result["items"], many=True).data,
            "filters": result.get("filters", {}),
            "page": page,
            "page_size": result.get("page_size") or result.get("per_page"),
            "total": result["total"],
            "next": page + 1 if page < total_pages else None,
            "previous": page - 1 if page > 1 else None,
        }
        return Response(response_data, status=status.HTTP_200_OK)

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
