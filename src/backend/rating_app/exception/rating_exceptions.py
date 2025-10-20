from rest_framework.exceptions import PermissionDenied


class NotEnrolledException(PermissionDenied):
    """Raised when a student tries to rate a course they're not enrolled in."""

    default_detail = "You must be enrolled in this course offering to rate it."
    default_code = "not_enrolled"


class DuplicateRatingException(PermissionDenied):
    """Raised when a student tries to rate a course offering they've already rated."""

    default_detail = "You have already rated this course offering"
    default_code = "duplicate_rating"
