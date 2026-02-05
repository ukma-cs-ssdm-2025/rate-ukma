import structlog

from rateukma.protocols import IProcessor, implements
from rating_app.application_schemas.course import Course as CourseDTO
from rating_app.application_schemas.course import CourseSpeciality
from rating_app.application_schemas.course_offering import CourseOffering as CourseOfferingDTO
from rating_app.application_schemas.instructor import Instructor as InstructorDTO
from rating_app.application_schemas.rating import Rating as RatingDTO
from rating_app.exception.course_exceptions import CourseMissingDepartmentOrFacultyError
from rating_app.models import Course
from rating_app.models.choices import (
    CourseStatus,
    CourseTypeKind,
    RatingVoteStrType,
    RatingVoteType,
)
from rating_app.models.course_offering import CourseOffering as CourseOfferingModel
from rating_app.models.instructor import Instructor as InstructorModel
from rating_app.models.rating import Rating as RatingModel

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


class RatingMapper(IProcessor[[RatingModel], RatingDTO]):
    @implements
    def process(self, model: RatingModel) -> RatingDTO:
        student_id = model.student.id if not model.is_anonymous else None
        student_name = (
            f"{model.student.last_name} {model.student.first_name}"
            if not model.is_anonymous
            else None
        )

        # annotated fields from ORM queryset
        upvotes = getattr(model, "upvotes_count", 0)
        downvotes = getattr(model, "downvotes_count", 0)

        return RatingDTO(
            id=model.id,
            course_offering_id=model.course_offering.id,
            student_id=student_id,
            student_name=student_name,
            course_offering=model.course_offering.id,
            course=model.course_offering.course.id,
            difficulty=model.difficulty,
            usefulness=model.usefulness,
            comment=model.comment if model.comment else None,
            is_anonymous=model.is_anonymous,
            created_at=model.created_at,
            upvotes=upvotes,
            downvotes=downvotes,
            viewer_vote=None,  # set by service layer based on viewer context
        )


class RatingVoteMapper:
    _db_to_domain: dict[int, RatingVoteStrType] = {
        RatingVoteType.UPVOTE: RatingVoteStrType.UPVOTE,
        RatingVoteType.DOWNVOTE: RatingVoteStrType.DOWNVOTE,
    }

    _domain_to_db: dict[str, RatingVoteType] = {
        RatingVoteStrType.UPVOTE: RatingVoteType.UPVOTE,
        RatingVoteStrType.DOWNVOTE: RatingVoteType.DOWNVOTE,
    }

    # exposing static methods for serializer
    @classmethod
    def to_domain(cls, db_value: RatingVoteType | int | None) -> RatingVoteStrType | None:
        if db_value is None:
            return None
        value = db_value.value if isinstance(db_value, RatingVoteType) else db_value
        return cls._db_to_domain.get(value)

    @classmethod
    def to_db(cls, domain_value: RatingVoteStrType | str | None) -> RatingVoteType | None:
        if domain_value is None:
            return None
        value = domain_value.value if isinstance(domain_value, RatingVoteStrType) else domain_value
        return cls._domain_to_db.get(value)


class InstructorMapper(IProcessor[[InstructorModel], InstructorDTO]):
    @implements
    def process(self, model: InstructorModel) -> InstructorDTO:
        return InstructorDTO(
            id=model.id,
            first_name=model.first_name,
            patronymic=model.patronymic,
            last_name=model.last_name,
            academic_degree=model.academic_degree,
            academic_title=model.academic_title,
        )


class CourseOfferingMapper(IProcessor[[CourseOfferingModel], CourseOfferingDTO]):
    def __init__(self, instructor_mapper: InstructorMapper | None = None):
        self._instructor_mapper = instructor_mapper or InstructorMapper()

    @implements
    def process(self, model: CourseOfferingModel) -> CourseOfferingDTO:
        instructors = self._map_instructors(model)

        course = getattr(model, "course", None)
        semester = getattr(model, "semester", None)

        return CourseOfferingDTO(
            id=model.id,
            code=model.code,
            course_id=model.course_id,  # type: ignore TODO: resolve type checker issue - prefetched field
            semester_id=model.semester_id,  # type: ignore TODO: resolve type checker issue - prefetched field
            credits=model.credits,
            weekly_hours=model.weekly_hours,
            exam_type=model.exam_type,
            lecture_count=model.lecture_count,
            practice_count=model.practice_count,
            practice_type=model.practice_type,
            max_students=model.max_students,
            max_groups=model.max_groups,
            group_size_min=model.group_size_min,
            group_size_max=model.group_size_max,
            instructors=instructors,
            course_title=course.title if course else None,
            semester_year=semester.year if semester else None,
            semester_term=semester.label if semester else None,
        )

    def _map_instructors(self, model: CourseOfferingModel) -> list[InstructorDTO]:
        prefetched_instructors = getattr(model, "_prefetched_objects_cache", {}).get("instructors")

        if prefetched_instructors is None:
            return []

        return [
            self._instructor_mapper.process(instructor) for instructor in prefetched_instructors
        ]
