import re
from typing import Any

import structlog

from ...models import ParsedCourseDetails
from ...models.deduplicated import (
    AcademicDegree,
    CourseStatus,
    DeduplicatedCourseInstructor,
    DeduplicatedEnrollment,
    DeduplicatedInstructor,
    DeduplicatedSemester,
    DeduplicatedSpeciality,
    DeduplicatedStudent,
    EducationLevel,
    EnrollmentStatus,
    ExamType,
    InstructorRole,
    PracticeType,
    SemesterTerm,
)
from .base import DataValidationError, Extractor

logger = structlog.get_logger(__name__)


class SemesterExtractor(Extractor[ParsedCourseDetails, list[DeduplicatedSemester]]):
    def extract(self, data: ParsedCourseDetails) -> list[DeduplicatedSemester]:
        if not data.academic_year:
            raise DataValidationError(f"Course {data.id} missing required academic_year")

        year = self._extract_year(data.academic_year)

        if not data.semesters:
            logger.warning(
                "semester_extraction_skipped",
                reason="missing_semester_data",
                course_id=data.id,
                title=data.title,
            )
            return []

        semesters = []
        for sem_label in data.semesters:
            term = self._map_semester_term(sem_label)
            if not term:
                logger.warning(
                    "invalid_semester_term_skipped",
                    course_id=data.id,
                    semester_label=sem_label,
                )
                continue
            semesters.append(DeduplicatedSemester(year=year, term=term))

        return semesters

    def _extract_year(self, academic_year: str) -> int:
        year_match = re.search(r"(\d{4})", academic_year)
        if not year_match:
            raise DataValidationError(f"Cannot extract year from academic year: {academic_year}")

        year = int(year_match.group(1))
        if year < 2000 or year > 2100:
            raise DataValidationError(f"Year {year} is outside valid range (2000-2100)")

        return year

    def _map_semester_term(self, label: str) -> SemesterTerm | None:
        label_lower = label.lower()
        if "осінній" in label_lower:
            return SemesterTerm.FALL
        elif "весняний" in label_lower:
            return SemesterTerm.SPRING
        elif "літній" in label_lower:
            return SemesterTerm.SUMMER
        return None


class InstructorExtractor(Extractor[ParsedCourseDetails, list[DeduplicatedCourseInstructor]]):
    def extract(self, data: ParsedCourseDetails) -> list[DeduplicatedCourseInstructor]:
        if not data.teachers:
            logger.debug(
                "instructor_extraction_empty",
                reason="no_teachers_data",
                course_id=data.id,
                title=data.title,
            )
            return []

        instructors = []
        teacher_parts = [part.strip() for part in data.teachers.split(",")]

        for teacher_part in teacher_parts:
            if not teacher_part:
                continue

            instructor = self._parse_instructor(teacher_part)
            if instructor:
                instructors.append(
                    DeduplicatedCourseInstructor(
                        instructor=instructor,
                        role=self._determine_role(teacher_part, data),
                    )
                )

        return instructors

    def _parse_instructor(self, teacher_str: str) -> DeduplicatedInstructor | None:
        if not teacher_str or not teacher_str.strip():
            logger.debug("empty_instructor_string_skipped")
            return None

        academic_degree = self._parse_academic_degree(teacher_str)
        clean_name = re.sub(r"[,،]\s*[дк]\.[а-я]+\.", "", teacher_str).strip()

        if not clean_name:
            logger.debug("instructor_name_empty_after_cleaning", original=teacher_str)
            return None

        name_parts = clean_name.split()
        if len(name_parts) >= 2:
            first_name = name_parts[0]
            last_name = name_parts[1]
            patronymic = name_parts[2] if len(name_parts) > 2 else None
        else:
            first_name = clean_name
            last_name = clean_name
            patronymic = None

        instructor = DeduplicatedInstructor(
            first_name=first_name,
            last_name=last_name,
            patronymic=patronymic,
            academic_degree=academic_degree,
            academic_title=None,
        )

        return instructor

    def _parse_academic_degree(self, teacher_str: str) -> AcademicDegree | None:
        if "д.і.н." in teacher_str or "к.і.н." in teacher_str:
            return AcademicDegree.PHD
        return None

    def _determine_role(self, teacher_str: str, data: ParsedCourseDetails) -> InstructorRole:
        return InstructorRole.LECTURE_INSTRUCTOR


class StudentExtractor(Extractor[ParsedCourseDetails, list[DeduplicatedEnrollment]]):
    def extract(self, data: ParsedCourseDetails) -> list[DeduplicatedEnrollment]:
        if not data.students:
            logger.debug(
                "student_extraction_empty",
                reason="no_students_data",
                course_id=data.id,
                title=data.title,
            )
            return []

        enrollments = []
        for student_row in data.students:
            student = self._parse_student(student_row)
            if student:
                enrollment = DeduplicatedEnrollment(
                    student=student,
                    status=self._determine_enrollment_status(student_row),
                )
                enrollments.append(enrollment)

        return enrollments

    def _parse_student(self, student_row: Any) -> DeduplicatedStudent | None:
        if not student_row:
            return None

        if hasattr(student_row, "name"):
            name = student_row.name
            index = getattr(student_row, "index", None)
            email = getattr(student_row, "email", None)
            specialty = getattr(student_row, "specialty", None)
            group = getattr(student_row, "group", None)
        elif isinstance(student_row, dict):
            name = student_row.get("name", "")
            index = student_row.get("index")
            email = student_row.get("email")
            specialty = student_row.get("specialty")
            group = student_row.get("group")
        else:
            logger.warning("invalid_student_data_format", student_data=type(student_row))
            return None

        if not name or not name.strip():
            logger.debug("student_name_empty_or_missing", student_data=student_row)
            return None

        name_parts = name.split()
        if len(name_parts) >= 2:
            first_name = name_parts[0]
            last_name = name_parts[1]
            patronymic = name_parts[2] if len(name_parts) > 2 else None
        else:
            first_name = name
            last_name = name
            patronymic = None

        student = DeduplicatedStudent(
            first_name=first_name,
            last_name=last_name,
            patronymic=patronymic,
            index=index,
            email=email,
            specialty=specialty,
            group=group,
        )

        return student

    def _determine_enrollment_status(self, student_row: Any) -> EnrollmentStatus:
        return EnrollmentStatus.ENROLLED


class SpecialtyExtractor(Extractor[ParsedCourseDetails, list[DeduplicatedSpeciality]]):
    def extract(self, data: ParsedCourseDetails) -> list[DeduplicatedSpeciality]:
        if not data.specialties:
            logger.debug(
                "specialty_extraction_empty",
                reason="no_specialties_data",
                course_id=data.id,
                title=data.title,
            )
            return []

        specialities = []
        seen_specialities = set()

        for spec in data.specialties:
            if hasattr(spec, "specialty") and hasattr(spec, "type"):
                name = spec.specialty
                spec_type = spec.type
            elif isinstance(spec, dict):
                name = spec.get("specialty", "")
                spec_type = spec.get("type", "")
            else:
                continue

            if not name:
                raise DataValidationError("Specialty missing required name field")

            key = (name.strip().lower(), spec_type.strip().lower())
            if key in seen_specialities:
                continue
            seen_specialities.add(key)

            education_level = self._map_education_level_from_type(spec_type)

            deduplicated_speciality = DeduplicatedSpeciality(
                name=name,
                faculty="",
                type=education_level,
            )
            specialities.append(deduplicated_speciality)

        return specialities

    def _map_education_level_from_type(self, spec_type: str) -> EducationLevel:
        if not spec_type:
            raise DataValidationError("Specialty type is required")

        type_lower = spec_type.lower()
        if "бакалавр" in type_lower:
            return EducationLevel.BACHELOR
        elif "магістр" in type_lower:
            return EducationLevel.MASTER
        elif "професійно-орієнтована" in type_lower or "обов'язкова" in type_lower:
            return EducationLevel.BACHELOR
        else:
            raise DataValidationError(f"Unrecognized specialty education level: {spec_type}")


class DescriptionExtractor(Extractor[ParsedCourseDetails, str]):
    def extract(self, data: ParsedCourseDetails) -> str:
        if data.annotation is None or data.annotation == "":
            return ""
        return data.annotation


class StatusExtractor(Extractor[ParsedCourseDetails, CourseStatus]):
    def extract(self, data: ParsedCourseDetails) -> CourseStatus:
        status = data.status
        if not status:
            return CourseStatus.PLANNED

        status_lower = status.lower()
        if "відбувся" in status_lower or "завершено" in status_lower:
            return CourseStatus.FINISHED
        elif "триває" in status_lower or "активний" in status_lower:
            return CourseStatus.ACTIVE
        else:
            return CourseStatus.PLANNED


class EducationLevelExtractor(Extractor[ParsedCourseDetails, EducationLevel]):
    def extract(self, data: ParsedCourseDetails) -> EducationLevel:
        level = data.education_level
        if not level:
            raise DataValidationError(f"Course {data.id} missing required education level")

        level_lower = level.lower()
        if "бакалавр" in level_lower:
            return EducationLevel.BACHELOR
        elif "магістр" in level_lower:
            return EducationLevel.MASTER
        else:
            raise DataValidationError(f"Course {data.id} has unrecognized education level: {level}")


class CreditsExtractor(Extractor[ParsedCourseDetails, float]):
    def extract(self, data: ParsedCourseDetails) -> float:
        return data.credits or 0.0


class WeeklyHoursExtractor(Extractor[ParsedCourseDetails, int]):
    def extract(self, data: ParsedCourseDetails) -> int:
        return data.hours or 0


class ExamTypeExtractor(Extractor[ParsedCourseDetails, ExamType]):
    def extract(self, data: ParsedCourseDetails) -> ExamType:
        format_str = data.format
        if not format_str:
            return ExamType.EXAM

        format_lower = format_str.lower()
        if "залік" in format_lower:
            return ExamType.CREDIT
        else:
            return ExamType.EXAM


class PracticeTypeExtractor(Extractor[ParsedCourseDetails, PracticeType | None]):
    def extract(self, data: ParsedCourseDetails) -> PracticeType | None:
        return None


class CourseLimitsExtractor(Extractor[ParsedCourseDetails, dict[str, int | None]]):
    def extract(self, data: ParsedCourseDetails) -> dict[str, int | None]:
        if not data.limits:
            raise DataValidationError(f"Course {data.id} missing required limits data")

        limits = {
            "max_students": data.limits.max_students,
            "max_groups": data.limits.max_groups,
            "group_size_min": data.limits.group_size_min,
            "group_size_max": data.limits.group_size_max,
        }

        return limits


class RequiredFieldExtractor(Extractor[ParsedCourseDetails, str]):
    def __init__(self, field_name: str):
        self.field_name = field_name

    def extract(self, data: ParsedCourseDetails) -> str:
        value = getattr(data, self.field_name, None)
        if value is None or (isinstance(value, str) and not value.strip()):
            raise DataValidationError(f"Course {data.id} missing required {self.field_name}")
        return value.strip() if isinstance(value, str) else value
