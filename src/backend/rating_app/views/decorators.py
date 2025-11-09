"""Decorators for view-level authorization and validation."""

from functools import wraps

from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError

import structlog

from rating_app.exception.rating_exceptions import (
    InvalidRatingIdentifierError,
    RatingNotFoundError,
)
from rating_app.exception.student_exceptions import (
    OnlyStudentActionAllowedError,
    StudentNotFoundError,
)

logger = structlog.get_logger(__name__)


def require_rating_ownership(func):
    """
    Decorator that ensures the authenticated user is the owner of the rating.

    This decorator:
    1. Validates rating_id parameter exists
    2. Fetches the authenticated student
    3. Fetches the rating by ID
    4. Checks ownership
    5. Injects 'student' and 'rating' into kwargs

    Usage:
        @require_rating_ownership
        def update(self, request, student=None, rating=None, **kwargs):
            # student and rating are guaranteed to exist and be authorized
            pass
    """

    @wraps(func)
    def wrapper(self, request, *args, **kwargs):
        assert self.rating_service is not None
        assert self.student_service is not None

        rating_id = kwargs.get("rating_id")
        if rating_id is None:
            raise ValidationError({"rating_id": "Rating id is required"})

        try:
            student = self.student_service.get_student_by_user_id(request.user.id)
        except StudentNotFoundError as exc:
            raise OnlyStudentActionAllowedError() from exc

        try:
            rating = self.rating_service.get_rating(rating_id)
        except InvalidRatingIdentifierError as exc:
            raise ValidationError({"rating_id": "Invalid rating identifier"}) from exc
        except RatingNotFoundError as exc:
            raise NotFound(detail=str(exc)) from exc

        if str(rating.student.id) != str(student.id):  # type: ignore
            logger.warning(
                "permission_denied",
                action=func.__name__,
                rating_id=rating_id,
                student_id=str(student.id),  # type: ignore
                rating_owner_id=str(rating.student.id),  # type: ignore
            )
            raise PermissionDenied(detail="You do not have permission to modify this rating.")

        kwargs["student"] = student
        kwargs["rating"] = rating

        return func(self, request, *args, **kwargs)

    return wrapper


def require_student(func):
    """
    Decorator that ensures the authenticated user has an associated student record.

    Injects 'student' into kwargs.

    Usage:
        @require_student
        def create(self, request, student=None, **kwargs):
            # student is guaranteed to exist
            pass
    """

    @wraps(func)
    def wrapper(self, request, *args, **kwargs):
        assert self.student_service is not None

        try:
            student = self.student_service.get_student_by_user_id(request.user.id)
        except StudentNotFoundError as exc:
            raise OnlyStudentActionAllowedError() from exc

        kwargs["student"] = student
        return func(self, request, *args, **kwargs)

    return wrapper
