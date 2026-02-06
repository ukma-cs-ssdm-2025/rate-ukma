from rest_framework import status
from rest_framework.exceptions import APIException, NotFound, ValidationError


class VoteAlreadyExistsException(APIException):
    default_detail = "You have already voted on this rating"
    default_code = "duplicate_vote"
    status_code = status.HTTP_409_CONFLICT


class VoteOnUnenrolledCourseException(APIException):
    default_detail = "You cannot vote on a rating for a course you are not enrolled in"
    default_code = "unenrolled_course_vote"
    status_code = status.HTTP_403_FORBIDDEN


class VoteOnOwnRatingException(APIException):
    default_detail = "You cannot vote on your own rating"
    default_code = "own_rating_vote"
    status_code = status.HTTP_403_FORBIDDEN


class DeleteVoteOnUnenrolledCourseException(APIException):
    default_detail = "You cannot delete a vote on a rating for a course you are not enrolled in"
    default_code = "unenrolled_course_vote"
    status_code = status.HTTP_403_FORBIDDEN


class RatingVoteNotFoundError(NotFound):
    default_detail = "Rating vote not found"
    default_code = "rating_vote_not_found"


class InvalidRatingVoteIdentifierError(ValidationError):
    default_detail = "Rating vote id is not a valid identifier."
    default_code = "invalid_rating_vote_identifier"
