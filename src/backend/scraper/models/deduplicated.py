from enum import Enum
from typing import Any

from pydantic import BaseModel


class EducationLevel(str, Enum):
    BACHELOR = "BACHELOR"
    MASTER = "MASTER"


class CourseStatus(str, Enum):
    PLANNED = "PLANNED"
    ACTIVE = "ACTIVE"
    FINISHED = "FINISHED"


class SemesterTerm(str, Enum):
    FALL = "FALL"
    SPRING = "SPRING"
    SUMMER = "SUMMER"


class ExamType(str, Enum):
    EXAM = "EXAM"
    CREDIT = "CREDIT"


class PracticeType(str, Enum):
    PRACTICE = "PRACTICE"
    SEMINAR = "SEMINAR"


class EnrollmentStatus(str, Enum):
    ENROLLED = "ENROLLED"
    DROPPED = "DROPPED"
    FORCED = "FORCED"


class AcademicDegree(str, Enum):
    PHD = "PHD"
    DOCTOR_OF_SCIENCES = "DRSCI"


class InstructorRole(str, Enum):
    LECTURE_INSTRUCTOR = "LECTURE_INSTRUCTOR"
    PRACTICUM_INSTRUCTOR = "PRACTICUM_INSTRUCTOR"


class AcademicTitle(str, Enum):
    ASSISTANT = "ASSISTANT"
    LECTURER = "LECTURER"
    SENIOR_LECTURER = "SENIOR_LECTURER"
    ASSOCIATE_PROF = "ASSOCIATE_PROF"
    PROFESSOR = "PROFESSOR"


class DeduplicatedStudent(BaseModel):
    first_name: str
    patronymic: str | None = None
    last_name: str
    index: str | None = None
    email: str | None = None
    speciality: str | None = None
    education_level: EducationLevel | None = None
    group: str | None = None


class DeduplicatedInstructor(BaseModel):
    first_name: str
    patronymic: str | None = None
    last_name: str
    academic_degree: AcademicDegree | None = None
    academic_title: AcademicTitle | None = None


class DeduplicatedSemester(BaseModel):
    year: int
    term: SemesterTerm


class DeduplicatedSpeciality(BaseModel):
    name: str
    faculty: str
    type: EducationLevel | None = None


class DeduplicatedEnrollment(BaseModel):
    student: DeduplicatedStudent
    status: EnrollmentStatus
    enrolled_at: str | None = None


class DeduplicatedCourseInstructor(BaseModel):
    instructor: DeduplicatedInstructor
    role: InstructorRole


class DeduplicatedCourseOffering(BaseModel):
    code: str
    semester: DeduplicatedSemester
    credits: float
    weekly_hours: int
    lecture_count: int | None = None
    practice_count: int | None = None
    practice_type: PracticeType | None = None
    exam_type: ExamType
    max_students: int | None = None
    max_groups: int | None = None
    group_size_min: int | None = None
    group_size_max: int | None = None
    instructors: list[DeduplicatedCourseInstructor] = []
    enrollments: list[DeduplicatedEnrollment] = []


class DeduplicatedCourse(BaseModel):
    title: str
    description: str | None = None
    status: CourseStatus
    department: str
    faculty: str
    education_level: EducationLevel | None = None
    specialities: list[DeduplicatedSpeciality] = []
    offerings: list[DeduplicatedCourseOffering] = []

    def model_dump_json_compat(self) -> dict[str, Any]:
        return self.model_dump(exclude_none=True, by_alias=False)
