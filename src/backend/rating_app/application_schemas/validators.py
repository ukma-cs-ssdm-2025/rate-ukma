import uuid

from pydantic import field_validator


def validate_uuid_string(field_name: str):
    """
    Factory function to create a UUID string validator for Pydantic fields.

    Usage:
        class MySchema(BaseModel):
            my_id: str

            validate_my_id = validate_uuid_string("my_id")

    Args:
        field_name: The name of the field being validated

    Returns:
        A field_validator decorator

    Raises:
        ValueError: When the value is not a valid UUID string
    """

    @field_validator(field_name, mode="before")
    @classmethod
    def _validate_uuid(cls, value):
        try:
            uuid.UUID(value)
        except (ValueError, TypeError) as e:
            raise ValueError(f"Invalid {field_name}: must be a valid UUID") from e
        return value

    return _validate_uuid


class CommonValidators:
    """
    Common validator methods that can be mixed into Pydantic models.

    This provides reusable validators for common patterns without code duplication.
    """

    # UUID string validators for common field names
    validate_rating_id = validate_uuid_string("rating_id")
    validate_course_id = validate_uuid_string("course_id")
    validate_student_id = validate_uuid_string("student_id")
    validate_instructor_id = validate_uuid_string("instructor_id")
