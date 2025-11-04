from drf_spectacular.helpers import forced_singular_serializer
from drf_spectacular.utils import OpenApiExample, OpenApiResponse

from rating_app.constants import MAX_RATING_VALUE, MIN_RATING_VALUE
from rating_app.serializers import (
    CourseDetailSerializer,
    CourseListResponseSerializer,
    FilterOptionsSerializer,
    InstructorSerializer,
    RatingReadSerializer,
    StudentRatingsDetailedSerializer,
    StudentRatingsLightSerializer,
)
from rating_app.serializers import ErrorEnvelopeSerializer as Err
from rating_app.serializers.auth import CSRFTokenSerializer, SessionSerializer

NOT_FOUND = "Not found"
INVALID_VALUE = "Invalid value"

RATING_NOT_FOUND_MSG = "Rating not found"
CONFLICT_RATING_EXISTS = "Conflict - Rating already exists"

EX_400 = OpenApiExample(
    "Validation error",
    value={
        "detail": "Validation failed",
        "status": 400,
        "fields": {"difficulty": [f"Must be between {MIN_RATING_VALUE} and {MAX_RATING_VALUE}."]},
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
    NOT_FOUND,
    value={"detail": NOT_FOUND, "status": 404},
    status_codes=["404"],
)
EX_409 = OpenApiExample(
    CONFLICT_RATING_EXISTS,
    value={
        "detail": "You have already rated this course offering",
        "status": 409,
    },
    status_codes=["409"],
)


def common_errors(include_400=True, include_401=True, include_403=True, include_404=False):
    errors = {}
    if include_400:
        errors[400] = OpenApiResponse(Err, "Bad request", [EX_400])
    if include_401:
        errors[401] = OpenApiResponse(Err, "Unauthorized", [EX_401])
    if include_403:
        errors[403] = OpenApiResponse(Err, "Forbidden", [EX_403])
    if include_404:
        errors[404] = OpenApiResponse(Err, NOT_FOUND, [EX_404])
    return errors


R_COURSE_LIST = {
    200: OpenApiResponse(forced_singular_serializer(CourseListResponseSerializer), "OK"),
    **common_errors(include_404=False),
}

R_COURSE = {
    200: OpenApiResponse(CourseDetailSerializer, "OK"),
    **common_errors(include_404=True),
}

R_FILTER_OPTIONS = {
    200: OpenApiResponse(FilterOptionsSerializer, "OK"),
    **common_errors(include_400=False, include_404=False),
}

R_RATING_LIST = {
    200: OpenApiResponse(RatingReadSerializer(many=True), "OK"),
    **common_errors(include_404=True),
}

R_RATING_CREATE = {
    201: RatingReadSerializer,
    **common_errors(include_404=True),
    409: OpenApiResponse(Err, CONFLICT_RATING_EXISTS, [EX_409]),
}

R_RATING = {
    200: RatingReadSerializer,
    **common_errors(include_404=True),
}

R_NO_CONTENT = {
    204: OpenApiResponse(description="Deleted"),
    **common_errors(include_400=False, include_404=True),
}

R_REDIRECT = {
    302: OpenApiResponse(description="Found: Temporary Redirect"),
}

R_OAUTH = {
    **R_REDIRECT,
    400: OpenApiResponse(Err, "Bad request", [EX_400]),
    404: OpenApiResponse(Err, NOT_FOUND, [EX_404]),
}

R_LOGIN = {
    200: OpenApiResponse(description="Logged in"),
    **common_errors(include_403=False, include_404=False),
}

R_LOGOUT = {
    **R_OAUTH,
    401: OpenApiResponse(Err, "Unauthorized", [EX_401]),
}

R_SESSION = {
    200: OpenApiResponse(SessionSerializer, "Session state"),
    401: OpenApiResponse(Err, "Unauthorized", [EX_401]),
}

R_CSRF_TOKEN = {
    200: OpenApiResponse(CSRFTokenSerializer, "CSRF token"),
}

R_INSTRUCTOR = {
    200: OpenApiResponse(InstructorSerializer, "OK"),
    **common_errors(include_404=True),
}

R_STUDENT_RATINGS = {
    200: OpenApiResponse(StudentRatingsLightSerializer, "Ok"),
    **common_errors(include_404=True),
}

R_STUDENT_RATINGS_DETAILED = {
    200: OpenApiResponse(StudentRatingsDetailedSerializer, "Ok"),
    **common_errors(include_404=True),
}
