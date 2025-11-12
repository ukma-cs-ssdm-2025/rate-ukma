from rest_framework.exceptions import NotFound, PermissionDenied


class StudentNotFoundError(NotFound):
    default_detail = "Student not found"
    default_code = "student_not_found"


class OnlyStudentActionAllowedError(PermissionDenied):
    default_detail = "Only students can perform this action."
    default_code = "only_student_action_allowed"
