from pydantic import BaseModel, Field
from pydantic.alias_generators import to_camel

from .validators import validate_uuid_string


class InstructorReadParams(BaseModel):
    model_config = {
        "alias_generator": to_camel,
        "populate_by_name": True,
    }

    instructor_id: str = Field(description="ID of the instructor being read")

    validate_instructor_id = validate_uuid_string("instructor_id")
