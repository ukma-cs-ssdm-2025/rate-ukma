from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError


class StudentNotFoundError(NotFound):
    default_detail = "Student not found"
    default_code = "student_not_found"


class InvalidStudentIdentifierError(ValidationError):
    default_detail = "Student id is not a valid identifier."
    default_code = "invalid_student_identifier"


class OnlyStudentActionAllowedError(PermissionDenied):
    default_detail = "Only students can perform this action."
    default_code = "only_student_action_allowed"
