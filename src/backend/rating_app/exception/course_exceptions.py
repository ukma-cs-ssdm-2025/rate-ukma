from rest_framework.exceptions import NotFound, ValidationError


class CourseNotFoundError(NotFound):
    default_detail = "Course not found"
    default_code = "course_not_found"


class InvalidCourseIdentifierError(ValidationError):
    default_detail = "Course id is not a valid identifier."
    default_code = "invalid_course_identifier"


class InvalidCourseOfferingIdentifierError(ValidationError):
    default_detail = "Course offering id is not a valid identifier."
    default_code = "invalid_course_offering_identifier"


class CourseMissingDepartmentOrFacultyError(ValidationError):
    default_detail = "Course is missing department or faculty."
    default_code = "course_missing_department_or_faculty"
