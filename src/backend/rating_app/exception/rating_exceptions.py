from rest_framework.exceptions import PermissionDenied


class NotEnrolledException(PermissionDenied):
    """Raised when a student tries to rate a course they're not enrolled in."""

    default_detail = "You must be enrolled in this course offering to rate it."
    default_code = "not_enrolled"
