from rest_framework.exceptions import NotFound, ValidationError


class FacultyNotFoundError(NotFound):
    default_detail = "Faculty not found"
    default_code = "faculty_not_found"


class InvalidFacultyIdentifierError(ValidationError):
    default_detail = "Faculty id is not a valid identifier."
    default_code = "invalid_faculty_identifier"
