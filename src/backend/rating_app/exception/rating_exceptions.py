from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError


class NotEnrolledException(PermissionDenied):
    default_detail = "You must be enrolled in this course offering to rate it."
    default_code = "not_enrolled"


class DuplicateRatingException(PermissionDenied):
    default_detail = "You have already rated this course offering"
    default_code = "duplicate_rating"


class RatingNotFoundError(NotFound):
    default_detail = "Rating not found"
    default_code = "rating_not_found"


class InvalidRatingIdentifierError(ValidationError):
    default_detail = "Invalid rating identifier"
    default_code = "invalid_rating_identifier"
