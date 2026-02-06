from rest_framework.exceptions import NotFound, ValidationError


class SpecialityNotFoundError(NotFound):
    default_detail = "Speciality not found"
    default_code = "speciality_not_found"


class InvalidSpecialityIdentifierError(ValidationError):
    default_detail = "Speciality id is not a valid identifier."
    default_code = "invalid_speciality_identifier"
