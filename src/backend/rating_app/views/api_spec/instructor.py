from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter

INSTRUCTOR_DETAIL_PATH_PARAMS = [
    OpenApiParameter(
        name="instructor_id",
        type=OpenApiTypes.UUID,
        location=OpenApiParameter.PATH,
        description="A unique identifier for the instructor.",
        required=True,
    ),
]
