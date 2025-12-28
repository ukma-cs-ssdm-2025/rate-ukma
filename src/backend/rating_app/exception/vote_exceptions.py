from rest_framework import status
from rest_framework.exceptions import APIException


class VoteAlreadyExistsException(APIException):
    default_detail = "You have already voted on this rating"
    default_code = "duplicate_vote"
    status_code = status.HTTP_409_CONFLICT


class VoteOnUnenrolledCourseException(APIException):
    default_detail = "You cannot vote on a rating for a course you are not enrolled in"
    default_code = "unenrolled_course_vote"
    status_code = status.HTTP_403_FORBIDDEN


class DeleteVoteOnUnenrolledCourseException(APIException):
    default_detail = "You cannot delete a vote on a rating for a course you are not enrolled in"
    default_code = "unenrolled_course_vote"
    status_code = status.HTTP_403_FORBIDDEN
