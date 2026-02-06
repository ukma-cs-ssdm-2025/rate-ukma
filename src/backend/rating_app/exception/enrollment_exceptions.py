from rest_framework.exceptions import NotFound, ValidationError


class EnrollmentNotFoundError(NotFound):
    default_detail = "Enrollment not found"
    default_code = "enrollment_not_found"


class InvalidEnrollmentIdentifierError(ValidationError):
    default_detail = "Enrollment id is not a valid identifier."
    default_code = "invalid_enrollment_identifier"
