import uuid

from pydantic import BaseModel, Field
from pydantic.alias_generators import to_snake


class CourseOfferingCourseFilterParams(BaseModel):
    model_config = {
        "alias_generator": to_snake,
        "populate_by_name": True,
    }

    course_id: uuid.UUID = Field(description="Unique identifier of offering course")


class CourseOfferingRetrieveParams(BaseModel):
    model_config = {
        "alias_generator": to_snake,
        "populate_by_name": True,
    }

    course_offering_id: uuid.UUID = Field(description="Unique identifier of course offering")
