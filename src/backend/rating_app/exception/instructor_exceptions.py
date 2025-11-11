from rest_framework.exceptions import NotFound


class InstructorNotFoundError(NotFound):
    default_detail = "Instructor not found"
    default_code = "instructor_not_found"
