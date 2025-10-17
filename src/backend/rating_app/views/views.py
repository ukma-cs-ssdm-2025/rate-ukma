from types import SimpleNamespace
from uuid import uuid4

from rest_framework.exceptions import NotFound
from rest_framework.response import Response
from rest_framework.views import APIView

from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema

from ..serializers import CourseDetailSerializer, CourseListSerializer, RatingSerializer
from .mock_store import (
    MOCK_COURSES,
    STATUS_ENUM,
    TYPE_ENUM,
    create_rating,
    delete_rating,
    get_rating,
    list_ratings,
    update_rating,
)
from .responses import (
    R_COURSE,
    R_COURSE_LIST,
    R_NO_CONTENT,
    R_RATING,
    R_RATING_CREATE,
    R_RATING_LIST,
)

# ---------- helpers ----------


def _wrap_many(items):
    return [SimpleNamespace(**i) for i in items]


def _wrap_one(item):
    return SimpleNamespace(**item)


def _course_exists(cid):
    return any(str(c["id"]) == str(cid) for c in MOCK_COURSES)


def _int(q, default):
    try:
        return int(q)
    except (TypeError, ValueError):
        return default


def _current_student_id(request):
    # mock 'logged-in student'
    return request.headers.get("X-Student-Id", "00000000-0000-0000-0000-000000000001")


def _with_request_id(resp: Response) -> Response:
    resp["X-Request-Id"] = f"req-mock-{uuid4()}"
    return resp


# ---------- views ----------


@extend_schema(
    summary="List courses (mock)",
    description="Returns a paginated list of courses with filters. Version: v1.",
    tags=["courses"],
    parameters=[
        OpenApiParameter(
            "status",
            OpenApiTypes.STR,
            OpenApiParameter.QUERY,
            required=False,
            enum=STATUS_ENUM,
        ),
        OpenApiParameter(
            "type_kind",
            OpenApiTypes.STR,
            OpenApiParameter.QUERY,
            required=False,
            enum=TYPE_ENUM,
        ),
        OpenApiParameter("search", OpenApiTypes.STR, OpenApiParameter.QUERY, required=False),
        OpenApiParameter("page", OpenApiTypes.INT, OpenApiParameter.QUERY, required=False),
        OpenApiParameter("pageSize", OpenApiTypes.INT, OpenApiParameter.QUERY, required=False),
    ],
    responses=R_COURSE_LIST,
)
class CourseListView(APIView):
    @extend_schema(operation_id="courses_list")
    def get(self, request):
        status_q = (request.query_params.get("status") or "").upper()
        type_kind_q = (request.query_params.get("type_kind") or "").upper()
        search_q = (request.query_params.get("search") or "").casefold()

        rows = MOCK_COURSES
        if status_q:
            rows = [c for c in rows if (c.get("status") or "").upper() == status_q]
        if type_kind_q:
            rows = [c for c in rows if (c.get("type_kind") or "").upper() == type_kind_q]
        if search_q:
            rows = [
                c
                for c in rows
                if search_q in (c.get("code", "").casefold())
                or search_q in (c.get("title", "").casefold())
            ]

        page = max(_int(request.query_params.get("page"), 1), 1)
        page_size = min(max(_int(request.query_params.get("pageSize"), 20), 1), 100)
        start = (page - 1) * page_size
        end = start + page_size
        paged = rows[start:end]

        payload = {
            "results": CourseListSerializer(_wrap_many(paged), many=True).data,
            "filters": {"status": STATUS_ENUM, "type_kind": TYPE_ENUM},
            "page": page,
            "pageSize": page_size,
            "total": len(rows),
        }
        return _with_request_id(Response(payload, status=200))


@extend_schema(
    tags=["courses"],
    summary="Get course by ID (mock)",
    description="Returns a single course by ID. Version: v1.",
    responses=R_COURSE,
)
class CourseDetailView(APIView):
    @extend_schema(operation_id="courses_retrieve")
    def get(self, request, course_id: str):
        row = next((c for c in MOCK_COURSES if str(c["id"]) == str(course_id)), None)
        if not row:
            raise NotFound("Course not found")
        return _with_request_id(Response(CourseDetailSerializer(_wrap_one(row)).data, status=200))


@extend_schema(tags=["ratings"])
class CourseRatingsListCreateView(APIView):
    @extend_schema(
        operation_id="course_ratings_list",
        summary="List ratings for a course (mock)",
        responses=R_RATING_LIST,
    )
    def get(self, request, course_id: str):
        if not _course_exists(course_id):
            raise NotFound("Course not found")
        data = list_ratings(course_id=course_id)
        return _with_request_id(
            Response(RatingSerializer(_wrap_many(data), many=True).data, status=200)
        )

    @extend_schema(
        operation_id="course_ratings_create",
        summary="Create rating for a course (mock)",
        request=RatingSerializer,
        responses=R_RATING_CREATE,
    )
    def post(self, request, course_id: str):
        if not _course_exists(course_id):
            raise NotFound("Course not found")

        payload = {
            "student": _current_student_id(request),
            "course": str(course_id),
            "difficulty": request.data.get("difficulty"),
            "usefulness": request.data.get("usefulness"),
            "comment": request.data.get("comment"),
        }
        ser = RatingSerializer(data=payload)
        ser.is_valid(raise_exception=True)

        created = create_rating(ser.validated_data)
        return _with_request_id(Response(RatingSerializer(_wrap_one(created)).data, status=201))


@extend_schema(tags=["ratings"])
class CourseRatingDetailView(APIView):
    @extend_schema(
        operation_id="course_rating_retrieve",
        summary="Retrieve rating for a course (mock)",
        responses=R_RATING,
    )
    def get(self, request, course_id: str, rating_id: str):
        if not _course_exists(course_id):
            raise NotFound("Course not found")

        item = get_rating(rating_id)
        if not item or str(item["course"]) != str(course_id):
            raise NotFound("Rating not found")

        return _with_request_id(Response(RatingSerializer(_wrap_one(item)).data, status=200))

    @extend_schema(
        operation_id="course_rating_update",
        summary="Update rating for a course (mock)",
        request=RatingSerializer,
        responses=R_RATING,
    )
    def patch(self, request, course_id: str, rating_id: str):
        if not _course_exists(course_id):
            raise NotFound("Course not found")

        item = get_rating(rating_id)
        if not item or str(item["course"]) != str(course_id):
            raise NotFound("Rating not found")

        if item["student"] != _current_student_id(request):
            return _with_request_id(
                Response(
                    {
                        "detail": "You do not have permission to perform this action",
                        "status": 403,
                    },
                    status=403,
                )
            )

        ser = RatingSerializer(data=request.data, partial=True)
        ser.is_valid(raise_exception=True)

        updated = update_rating(rating_id, ser.validated_data)
        return _with_request_id(Response(RatingSerializer(_wrap_one(updated)).data, status=200))

    @extend_schema(
        operation_id="course_rating_delete",
        summary="Delete rating for a course (mock)",
        responses=R_NO_CONTENT,
    )
    def delete(self, request, course_id: str, rating_id: str):
        if not _course_exists(course_id):
            raise NotFound("Course not found")

        item = get_rating(rating_id)
        if not item or str(item["course"]) != str(course_id):
            raise NotFound("Rating not found")

        if item["student"] != _current_student_id(request):
            return _with_request_id(
                Response(
                    {
                        "detail": "You do not have permission to perform this action",
                        "status": 403,
                    },
                    status=403,
                )
            )

        delete_rating(rating_id)
        return _with_request_id(Response(status=204))
