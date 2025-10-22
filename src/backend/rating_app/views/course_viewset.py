from rest_framework import status, viewsets
from rest_framework.exceptions import NotFound
from rest_framework.response import Response

from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema

from rating_app.constants import DEFAULT_COURSE_PAGE_SIZE, DEFAULT_PAGE_NUMBER
from rating_app.ioc_container.services import course_service
from rating_app.models import Course
from rating_app.models.choices import SemesterTerm
from rating_app.serializers.course.course_detail import CourseDetailSerializer
from rating_app.serializers.course.course_list import CourseListSerializer
from rating_app.views.responses import R_COURSE, R_COURSE_LIST


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
        if semester_year_raw is not None:
            try:
                semester_year = int(request.query_params.get("semesterYear"))
            except (ValueError, TypeError):
                semester_year = None
        else:
            semester_year = None

        semester_term = request.query_params.get("semesterTerm")
        if semester_term:
            normalized_term = semester_term.upper()
            if normalized_term in SemesterTerm.values:
                semester_term = normalized_term
            else:
                semester_term = None

        # Handle order parameters
        avg_difficulty_order = request.query_params.get("avg_difficulty_order")
        avg_usefulness_order = request.query_params.get("avg_usefulness_order")

        result = self.course_service.filter_courses(
            name=request.query_params.get("name"),
            type_kind=request.query_params.get("typeKind"),
            instructor=request.query_params.get("instructor"),
            faculty=request.query_params.get("faculty"),
            department=request.query_params.get("department"),
            speciality=request.query_params.get("speciality"),
            semester_year=semester_year,
            semester_term=semester_term,
            avg_difficulty_order=avg_difficulty_order,
            avg_usefulness_order=avg_usefulness_order,
            page_size=page_size,
            page=page,
        )

        page = result.page or 1
        total_pages = result.total or 1

        filters_dict = result.filters.__dict__ if result.filters else {}

        response_data = {
            "items": self.serializer_class(result.items, many=True).data,
            "filters": filters_dict,
            "page": page,
            "page_size": result.page_size,
            "total": result.total,
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
