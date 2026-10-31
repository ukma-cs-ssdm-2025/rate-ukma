from rest_framework import status
from rest_framework.exceptions import APIException, NotFound


class PlanSemesterUnavailableError(APIException):
    default_detail = "This semester cannot be planned."
    default_code = "plan_semester_unavailable"
    status_code = status.HTTP_400_BAD_REQUEST


class CourseAlreadyTakenError(APIException):
    default_detail = "This course is already in the plan from САЗ."
    default_code = "course_already_taken"
    status_code = status.HTTP_409_CONFLICT


class CourseIsMandatoryError(APIException):
    default_detail = "This course is mandatory in the programme."
    default_code = "course_is_mandatory"
    status_code = status.HTTP_409_CONFLICT


class PlannedCourseNotFoundError(NotFound):
    default_detail = "Course is not in the plan"
    default_code = "planned_course_not_found"


class CourseNotOfferedError(APIException):
    default_detail = "This course has no offering to plan."
    default_code = "course_not_offered"
    status_code = status.HTTP_400_BAD_REQUEST
