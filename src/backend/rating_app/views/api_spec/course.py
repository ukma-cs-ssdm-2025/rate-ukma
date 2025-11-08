from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter

from rating_app.constants import (
    MAX_RATING_VALUE,
    MIN_RATING_VALUE,
)

COURSES_LIST_QUERY_PARAMS = [
    OpenApiParameter(
        name="name",
        type=OpenApiTypes.STR,
        location=OpenApiParameter.QUERY,
        required=False,
        description="Filter courses by name (case-insensitive partial match)",
    ),
    OpenApiParameter(
        name="typeKind",
        type=OpenApiTypes.STR,
        location=OpenApiParameter.QUERY,
        required=False,
        description="Filter by course type (COMPULSORY, ELECTIVE, PROF_ORIENTED)",
    ),
    OpenApiParameter(
        name="instructor",
        type=OpenApiTypes.UUID,
        location=OpenApiParameter.QUERY,
        required=False,
        description="Filter by instructor ID",
    ),
    OpenApiParameter(
        name="faculty",
        type=OpenApiTypes.UUID,
        location=OpenApiParameter.QUERY,
        required=False,
        description="Filter by faculty ID",
    ),
    OpenApiParameter(
        name="department",
        type=OpenApiTypes.UUID,
        location=OpenApiParameter.QUERY,
        required=False,
        description="Filter by department ID",
    ),
    OpenApiParameter(
        name="speciality",
        type=OpenApiTypes.UUID,
        location=OpenApiParameter.QUERY,
        required=False,
        description="Filter by speciality ID",
    ),
    OpenApiParameter(
        name="semesterYear",
        type=OpenApiTypes.INT,
        location=OpenApiParameter.QUERY,
        required=False,
        description="Filter by semester year",
    ),
    OpenApiParameter(
        name="semesterTerm",
        type=OpenApiTypes.STR,
        location=OpenApiParameter.QUERY,
        required=False,
        description="Filter by semester term (FALL, SPRING, SUMMER)",
    ),
    OpenApiParameter(
        name="avg_difficulty_order",
        type=OpenApiTypes.STR,
        location=OpenApiParameter.QUERY,
        enum=["asc", "desc"],
        required=False,
        description="Sort by average difficulty (asc or desc)",
    ),
    OpenApiParameter(
        name="avg_usefulness_order",
        type=OpenApiTypes.STR,
        location=OpenApiParameter.QUERY,
        enum=["asc", "desc"],
        required=False,
        description="Sort by average usefulness (asc or desc)",
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
]

COURSES_LIST_PAGINATED_QUERY_PARAMS = [
    *COURSES_LIST_QUERY_PARAMS,
    OpenApiParameter(
        name="page",
        type=OpenApiTypes.INT,
        location=OpenApiParameter.QUERY,
        required=False,
        description="Page number (default: 1)",
    ),
    OpenApiParameter(
        name="page_size",
        type=OpenApiTypes.INT,
        location=OpenApiParameter.QUERY,
        required=False,
        description="Page size (default: 20)",
    ),
]


SINGLE_COURSE_QUERY_PARAMS = [
    OpenApiParameter(
        name="course_id",
        type=OpenApiTypes.UUID,
        location=OpenApiParameter.PATH,
        description="A unique identifier for the course.",
        required=True,
    ),
]
