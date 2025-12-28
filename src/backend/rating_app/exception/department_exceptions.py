from rest_framework.exceptions import NotFound, ValidationError


class DepartmentNotFoundError(NotFound):
    default_detail = "Department not found"
    default_code = "department_not_found"


class InvalidDepartmentIdentifierError(ValidationError):
    default_detail = "Department id is not a valid identifier."
    default_code = "invalid_department_identifier"
