from rest_framework.exceptions import NotFound, ValidationError


class InstructorNotFoundError(NotFound):
    default_detail = "Instructor not found"
    default_code = "instructor_not_found"


class InvalidInstructorIdsError(ValidationError):
    default_detail = "One or more instructor ids do not reference an existing instructor"
    default_code = "invalid_instructor_ids"
