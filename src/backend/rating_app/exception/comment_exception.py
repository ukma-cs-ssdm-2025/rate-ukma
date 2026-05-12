from rest_framework import status
from rest_framework.exceptions import NotFound, ValidationError, NotFound

class CommentNotFoundError(NotFound):
    default_detail = "Comment not found"
    default_code = "comment_not_found"


class InvalidCommentIdentifierError(ValidationError):
    default_detail = "Invalid comment identifier"
    default_code = "invalid_comment_identifier"


class RatingNotFoundError(NotFound):
    default_detail = "Rating not found"
    default_code = "rating_not_found"

