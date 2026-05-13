from rest_framework.exceptions import NotFound, ValidationError


class CommentNotFoundError(NotFound):
    default_detail = "Comment not found"
    default_code = "comment_not_found"


class InvalidCommentIdentifierError(ValidationError):
    default_detail = "Invalid comment identifier"
    default_code = "invalid_comment_identifier"


class CommentParentRatingMismatchError(ValidationError):
    default_detail = "Parent comment must belong to the same rating"
    default_code = "comment_parent_rating_mismatch"


class RatingNotFoundError(NotFound):
    default_detail = "Rating not found"
    default_code = "rating_not_found"
