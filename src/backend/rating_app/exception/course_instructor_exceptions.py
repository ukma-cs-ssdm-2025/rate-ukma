from rest_framework.exceptions import NotFound, ValidationError


class CourseInstructorNotFoundError(NotFound):
    default_detail = "Course instructor not found"
    default_code = "course_instructor_not_found"


class InvalidCourseInstructorIdentifierError(ValidationError):
    default_detail = "Course instructor id is not a valid identifier."
    default_code = "invalid_course_instructor_identifier"
