from rest_framework import status
from rest_framework.exceptions import APIException, NotFound, PermissionDenied, ValidationError


class NotEnrolledException(PermissionDenied):
    default_detail = "You must be enrolled in this course offering to rate it."
    default_code = "not_enrolled"


class RatingPeriodNotStarted(PermissionDenied):
    default_detail = "You cannot rate this course yet."
    default_code = "enrolled_but_not_completed"


class DuplicateRatingException(APIException):
    default_detail = "You have already rated this course offering"
    default_code = "duplicate_rating"
    status_code = status.HTTP_409_CONFLICT


class RatingNotFoundError(NotFound):
    default_detail = "Rating not found"
    default_code = "rating_not_found"


class InvalidRatingIdentifierError(ValidationError):
    default_detail = "Invalid rating identifier"
    default_code = "invalid_rating_identifier"
