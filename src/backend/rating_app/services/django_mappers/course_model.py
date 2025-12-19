from rating_app.application_schemas.course import Course as CourseDTO
from rating_app.application_schemas.course import CourseSpeciality
from rating_app.models.choices import CourseStatus
from rating_app.models.course import Course as CourseModel

from .protocol import IDjangoToDomainModelMapper


class CourseModelMapper(IDjangoToDomainModelMapper[CourseModel, CourseDTO]):
    def map_to_dto(self, model: CourseModel) -> CourseDTO:
        department = model.department
        department_id = str(department.id)
        faculty_obj = department.faculty if department else None
        faculty_id = str(faculty_obj.id) if faculty_obj else ""
        faculty_name = faculty_obj.name if faculty_obj else ""
        faculty_custom_abbreviation = faculty_obj.custom_abbreviation if faculty_obj else None
        status = model.status
        status = CourseStatus(status) if status in CourseStatus.values else CourseStatus.PLANNED
        specialities = self._parse_prefetched_course_specialities(model)

        return CourseDTO(
            id=str(model.id),
            title=model.title,
            description=model.description,
            status=status,
            department=department_id,
            department_name=department.name if department else "",
            faculty=faculty_id,
            faculty_name=faculty_name,
            faculty_custom_abbreviation=faculty_custom_abbreviation,
            specialities=specialities,
            avg_difficulty=model.avg_difficulty,
            avg_usefulness=model.avg_usefulness,
            ratings_count=model.ratings_count,
        )

    def _parse_prefetched_course_specialities(self, model: CourseModel) -> list[CourseSpeciality]:
        prefetched_course_specialities = getattr(model, "_prefetched_objects_cache", {}).get(
            "course_specialities"
        )
        specialities: list[CourseSpeciality] = []

        if prefetched_course_specialities is None:
            return specialities

        for course_speciality in prefetched_course_specialities:
            speciality = getattr(course_speciality, "speciality", None)
            if speciality is None:
                continue

            faculty_obj = speciality.faculty
            faculty_id = str(faculty_obj.id) if faculty_obj else ""
            faculty_name = faculty_obj.name if faculty_obj else ""

            specialities.append(
                CourseSpeciality(
                    speciality_id=str(speciality.id),
                    speciality_title=speciality.name,
                    faculty_id=faculty_id,
                    faculty_name=faculty_name,
                    speciality_alias=speciality.alias,
                    type_kind=course_speciality.type_kind,
                )
            )
        return specialities
