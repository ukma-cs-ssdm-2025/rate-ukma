import structlog

from rateukma.protocols import IProcessor, implements
from rating_app.application_schemas.course import Course as CourseDTO
from rating_app.application_schemas.course import CourseSpeciality
from rating_app.application_schemas.course_instructor import CourseInstructor as CourseInstructorDTO
from rating_app.application_schemas.course_offering import CourseOffering as CourseOfferingDTO
from rating_app.application_schemas.department import Department as DepartmentDTO
from rating_app.application_schemas.enrollment import Enrollment as EnrollmentDTO
from rating_app.application_schemas.faculty import Faculty as FacultyDTO
from rating_app.application_schemas.instructor import Instructor as InstructorDTO
from rating_app.application_schemas.rating import Rating as RatingDTO
from rating_app.application_schemas.rating_vote import RatingVote as RatingVoteDTO
from rating_app.application_schemas.semester import Semester as SemesterDTO
from rating_app.application_schemas.speciality import Speciality as SpecialityDTO
from rating_app.application_schemas.student import Student as StudentDTO
from rating_app.exception.course_exceptions import CourseMissingDepartmentOrFacultyError
from rating_app.models import Course
from rating_app.models.choices import (
    CourseStatus,
    CourseTypeKind,
    EducationLevel,
    EnrollmentStatus,
    ExamType,
    InstructorRole,
    PracticeType,
    RatingVoteStrType,
    RatingVoteType,
    SemesterTerm,
)
from rating_app.models.course_instructor import CourseInstructor as CourseInstructorModel
from rating_app.models.course_offering import CourseOffering as CourseOfferingModel
from rating_app.models.department import Department as DepartmentModel
from rating_app.models.enrollment import Enrollment as EnrollmentModel
from rating_app.models.faculty import Faculty as FacultyModel
from rating_app.models.instructor import Instructor as InstructorModel
from rating_app.models.rating import Rating as RatingModel
from rating_app.models.rating_vote import RatingVote as RatingVoteModel
from rating_app.models.semester import Semester as SemesterModel
from rating_app.models.speciality import Speciality as SpecialityModel
from rating_app.models.student import Student as StudentModel

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

        exam_type = (
            ExamType(model.exam_type)
            if model.exam_type and model.exam_type in ExamType.values
            else ExamType.EXAM
        )
        practice_type = (
            PracticeType(model.practice_type)
            if model.practice_type and model.practice_type in PracticeType.values
            else None
        )

        return CourseOfferingDTO(
            id=model.id,
            code=model.code,
            course_id=model.course_id,  # type: ignore TODO: resolve type checker issue - prefetched field
            semester_id=model.semester_id,  # type: ignore TODO: resolve type checker issue - prefetched field
            credits=model.credits,
            weekly_hours=model.weekly_hours,
            exam_type=exam_type,
            lecture_count=model.lecture_count,
            practice_count=model.practice_count,
            practice_type=practice_type,
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


class StudentMapper(IProcessor[[StudentModel], StudentDTO]):
    @implements
    def process(self, model: StudentModel) -> StudentDTO:
        speciality = getattr(model, "speciality", None)
        speciality_name = speciality.name if speciality else None

        education_level = model.education_level
        if education_level and education_level in EducationLevel.values:
            education_level = EducationLevel(education_level)

        return StudentDTO(
            id=model.id,
            first_name=model.first_name,
            last_name=model.last_name,
            patronymic=model.patronymic or None,
            education_level=education_level,
            speciality_id=model.speciality_id,
            email=model.email or None,
            user_id=model.user_id,
            speciality_name=speciality_name,
        )


class DepartmentMapper(IProcessor[[DepartmentModel], DepartmentDTO]):
    @implements
    def process(self, model: DepartmentModel) -> DepartmentDTO:
        faculty = getattr(model, "faculty", None)
        faculty_name = faculty.name if faculty else None

        return DepartmentDTO(
            id=model.id,
            name=model.name,
            faculty_id=model.faculty_id,
            faculty_name=faculty_name,
        )


class SemesterMapper(IProcessor[[SemesterModel], SemesterDTO]):
    @implements
    def process(self, model: SemesterModel) -> SemesterDTO:
        term = model.term
        if term and term in SemesterTerm.values:
            term = SemesterTerm(term)

        return SemesterDTO(
            id=model.id,
            year=model.year,
            term=term,
            label=model.label,
        )


class SpecialityMapper(IProcessor[[SpecialityModel], SpecialityDTO]):
    @implements
    def process(self, model: SpecialityModel) -> SpecialityDTO:
        faculty = getattr(model, "faculty", None)
        faculty_name = faculty.name if faculty else None

        return SpecialityDTO(
            id=model.id,
            name=model.name,
            faculty_id=model.faculty_id,
            alias=model.alias or None,
            faculty_name=faculty_name,
        )


class FacultyMapper(IProcessor[[FacultyModel], FacultyDTO]):
    @implements
    def process(self, model: FacultyModel) -> FacultyDTO:
        return FacultyDTO(
            id=model.id,
            name=model.name,
            custom_abbreviation=model.custom_abbreviation,
        )


class RatingVoteModelMapper(IProcessor[[RatingVoteModel], RatingVoteDTO]):
    @implements
    def process(self, model: RatingVoteModel) -> RatingVoteDTO:
        return RatingVoteDTO(
            id=model.id,
            student_id=model.student_id,
            rating_id=model.rating_id,
            vote_type=model.type,
        )


class CourseInstructorMapper(IProcessor[[CourseInstructorModel], CourseInstructorDTO]):
    @implements
    def process(self, model: CourseInstructorModel) -> CourseInstructorDTO:
        role = model.role
        if role and role in InstructorRole.values:
            role = InstructorRole(role)

        return CourseInstructorDTO(
            id=model.id,
            instructor_id=model.instructor_id,
            course_offering_id=model.course_offering_id,
            role=role,
        )


class EnrollmentMapper(IProcessor[[EnrollmentModel], EnrollmentDTO]):
    @implements
    def process(self, model: EnrollmentModel) -> EnrollmentDTO:
        status = model.status
        if status and status in EnrollmentStatus.values:
            status = EnrollmentStatus(status)

        return EnrollmentDTO(
            id=model.id,
            student_id=model.student_id,
            offering_id=model.offering_id,
            status=status,
            enrolled_at=model.enrolled_at,
        )
