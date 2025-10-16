from drf_spectacular.utils import OpenApiExample, OpenApiResponse

from ..serializers import CourseListResponseSerializer, CourseSerializer, RatingSerializer
from ..serializers import ErrorEnvelopeSerializer as Err

EX_400 = OpenApiExample(
    "Validation error",
    value={
        "detail": "Validation failed",
        "status": 400,
    },
    status_codes=["400"],
)
EX_401 = OpenApiExample(
    "Unauthorized",
    value={"detail": "Authentication credentials were not provided", "status": 401},
    status_codes=["401"],
)
EX_403 = OpenApiExample(
    "Forbidden",
    value={
        "detail": "You do not have permission to perform this action",
        "status": 403,
    },
    status_codes=["403"],
)
EX_404 = OpenApiExample(
    "Not found",
    value={"detail": "Not found", "status": 404},
    status_codes=["404"],
)

R_COURSE_LIST = {
    200: CourseListResponseSerializer,
    400: OpenApiResponse(Err, "Bad request", [EX_400]),
    401: OpenApiResponse(Err, "Unauthorized", [EX_401]),
    403: OpenApiResponse(Err, "Forbidden", [EX_403]),
}

R_COURSE = {
    200: CourseSerializer,
    401: OpenApiResponse(Err, "Unauthorized", [EX_401]),
    403: OpenApiResponse(Err, "Forbidden", [EX_403]),
    404: OpenApiResponse(Err, "Not found", [EX_404]),
}

R_RATING_LIST = {
    200: OpenApiResponse(RatingSerializer(many=True), "OK"),
    400: OpenApiResponse(Err, "Bad request", [EX_400]),
    401: OpenApiResponse(Err, "Unauthorized", [EX_401]),
    403: OpenApiResponse(Err, "Forbidden", [EX_403]),
    404: OpenApiResponse(Err, "Not found", [EX_404]),
}

R_RATING_CREATE = {
    201: RatingSerializer,
    400: OpenApiResponse(Err, "Bad request", [EX_400]),
    401: OpenApiResponse(Err, "Unauthorized", [EX_401]),
    403: OpenApiResponse(Err, "Forbidden", [EX_403]),
    404: OpenApiResponse(Err, "Not found", [EX_404]),
}

R_RATING = {
    200: RatingSerializer,
    400: OpenApiResponse(Err, "Bad request", [EX_400]),
    401: OpenApiResponse(Err, "Unauthorized", [EX_401]),
    403: OpenApiResponse(Err, "Forbidden", [EX_403]),
    404: OpenApiResponse(Err, "Not found", [EX_404]),
}

R_NO_CONTENT = {
    204: OpenApiResponse(description="Deleted"),
    401: OpenApiResponse(Err, "Unauthorized", [EX_401]),
    403: OpenApiResponse(Err, "Forbidden", [EX_403]),
    404: OpenApiResponse(Err, "Not found", [EX_404]),
}

R_REDIRECT = {
    302: OpenApiResponse(description="Found: Temporary Redirect"),
}

R_OAUTH = {
    **R_REDIRECT,
    400: OpenApiResponse(Err, "Bad request", [EX_400]),
    404: OpenApiResponse(Err, "Not found", [EX_404]),
}

R_LOGIN = {
    200: OpenApiResponse(description="Logged in"),
    400: OpenApiResponse(Err, "Bad request", [EX_400]),
    401: OpenApiResponse(Err, "Unauthorized", [EX_401]),
}

R_LOGOUT = {
    **R_OAUTH,
    401: OpenApiResponse(Err, "Unauthorized", [EX_401]),
}
