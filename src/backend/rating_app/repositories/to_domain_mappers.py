import structlog

from rateukma.protocols import IProcessor, implements
from rating_app.application_schemas.course import Course as CourseDTO
from rating_app.application_schemas.course import CourseSpeciality
from rating_app.exception.course_exceptions import CourseMissingDepartmentOrFacultyError
from rating_app.models import Course
from rating_app.models.choices import CourseStatus, CourseTypeKind

logger = structlog.get_logger(__name__)


class CourseMapper(IProcessor[[Course], CourseDTO]):
    @implements
    def process(self, model: Course) -> CourseDTO:
        department = model.department
        faculty = department.faculty if department else None

        if not department or not faculty:
            logger.warning(
                "course_missing_department_or_faculty",
                course_id=str(model.id),
            )
            raise CourseMissingDepartmentOrFacultyError(str(model.id))

        department_id = str(department.id)
        department_name = department.name
        faculty_id = str(faculty.id)
        faculty_name = faculty.name
        faculty_custom_abbreviation = faculty.custom_abbreviation

        status = model.status
        status = CourseStatus(status) if status in CourseStatus.values else CourseStatus.PLANNED

        specialities = self._map_specialities(model)

        return CourseDTO(
            id=str(model.id),
            title=model.title,
            description=model.description,
            status=status,
            department=department_id,
            department_name=department_name,
            faculty=faculty_id,
            faculty_name=faculty_name,
            faculty_custom_abbreviation=faculty_custom_abbreviation,
            specialities=specialities,
            avg_difficulty=model.avg_difficulty,
            avg_usefulness=model.avg_usefulness,
            ratings_count=model.ratings_count,
        )

    def _map_specialities(self, model: Course) -> list[CourseSpeciality]:
        prefetched_course_specialities = getattr(model, "_prefetched_objects_cache", {}).get(
            "course_specialities"
        )
        specialities: list[CourseSpeciality] = []

        if prefetched_course_specialities is None:
            return specialities

        for course_speciality in prefetched_course_specialities:
            speciality = getattr(course_speciality, "speciality", None)
            if speciality is None:
                logger.warning(
                    "course_speciality_missing_speciality",
                    course_speciality_id=str(course_speciality.id),
                )
                continue

            type_kind_raw = course_speciality.type_kind
            type_kind: CourseTypeKind | None = None
            if type_kind_raw:
                try:
                    type_kind = CourseTypeKind(type_kind_raw)
                except ValueError:
                    logger.warning(
                        "course_speciality_invalid_type_kind",
                        course_speciality_id=str(course_speciality.id),
                        speciality_id=str(speciality.id),
                        type_kind=str(type_kind_raw),
                    )

            faculty_obj = speciality.faculty
            if faculty_obj is None:
                logger.warning(
                    "course_speciality_missing_faculty",
                    course_speciality_id=str(course_speciality.id),
                    speciality_id=str(speciality.id),
                )
                continue

            specialities.append(
                CourseSpeciality(
                    speciality_id=str(speciality.id),
                    speciality_title=speciality.name,
                    faculty_id=str(faculty_obj.id),
                    faculty_name=faculty_obj.name,
                    speciality_alias=speciality.alias,
                    type_kind=type_kind,
                )
            )

        return specialities
