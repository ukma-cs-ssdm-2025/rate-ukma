from rest_framework.exceptions import NotFound, ValidationError


class SemesterDoesNotExistError(Exception):
    pass


class SemesterNotFoundError(NotFound):
    default_detail = "Semester not found"
    default_code = "semester_not_found"


class InvalidSemesterIdentifierError(ValidationError):
    default_detail = "Semester id is not a valid identifier."
    default_code = "invalid_semester_identifier"
