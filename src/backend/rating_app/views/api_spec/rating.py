from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter

from rating_app.constants import DEFAULT_PAGE_NUMBER, DEFAULT_PAGE_SIZE

RATING_LIST_QUERY_PARAMS = [
    OpenApiParameter(
        name="course_id",
        type=OpenApiTypes.UUID,
        location=OpenApiParameter.PATH,
        description="Course ID from URL path",
        required=False,
    ),
    OpenApiParameter(
        name="page",
        type=OpenApiTypes.INT,
        location=OpenApiParameter.QUERY,
        description=f"Page number (default: {DEFAULT_PAGE_NUMBER})",
        required=False,
    ),
    OpenApiParameter(
        name="page_size",
        type=OpenApiTypes.INT,
        location=OpenApiParameter.QUERY,
        description=f"Items per page (default: {DEFAULT_PAGE_SIZE})",
        required=False,
    ),
]

RATING_DETAIL_PATH_PARAMS = [
    OpenApiParameter(
        name="rating_id",
        type=OpenApiTypes.UUID,
        location=OpenApiParameter.PATH,
        description="A unique identifier for the rating.",
        required=True,
    ),
]

RATING_COURSE_ID_PATH_PARAM = [
    OpenApiParameter(
        name="course_id",
        type=OpenApiTypes.UUID,
        location=OpenApiParameter.PATH,
        description="Course ID from URL path",
        required=False,
    ),
]
