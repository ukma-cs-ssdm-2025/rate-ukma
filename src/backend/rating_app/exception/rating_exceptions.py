from rest_framework.exceptions import PermissionDenied


class NotEnrolledException(PermissionDenied):
    default_detail = "You must be enrolled in this course offering to rate it."
    default_code = "not_enrolled"


class DuplicateRatingException(PermissionDenied):
    default_detail = "You have already rated this course offering"
    default_code = "duplicate_rating"
