import uuid

from pydantic import BaseModel, Field
from pydantic.alias_generators import to_snake


class InstructorReadParams(BaseModel):
    model_config = {
        "alias_generator": to_snake,
        "populate_by_name": True,
    }

    instructor_id: uuid.UUID = Field(description="Unique identifier of instructor")
