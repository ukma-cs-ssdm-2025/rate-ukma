import uuid

from pydantic import BaseModel, Field, ValidationError, field_validator
from pydantic.alias_generators import to_camel


class InstructorReadParams(BaseModel):
    model_config = {
        "alias_generator": to_camel,
        "populate_by_name": True,
    }

    instructor_id: str = Field(description="ID of the instructor being read")

    @field_validator("instructor_id", mode="before")
    @classmethod
    def normalize_instructor_id(cls, value):
        try:
            uuid.UUID(value)
        except ValueError as e:
            raise ValidationError("Invalid instructor id") from e

        return value
