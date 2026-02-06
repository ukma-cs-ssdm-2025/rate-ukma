import uuid
from dataclasses import dataclass

from rating_app.models.choices import InstructorRole


@dataclass(frozen=True)
class CourseInstructorInput:
    instructor_id: uuid.UUID
    course_offering_id: uuid.UUID
    role: InstructorRole | str


@dataclass(frozen=True)
class CourseInstructor:
    id: uuid.UUID
    instructor_id: uuid.UUID
    course_offering_id: uuid.UUID
    role: InstructorRole | str
