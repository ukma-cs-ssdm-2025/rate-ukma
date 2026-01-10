import structlog

from rateukma.protocols import IProcessor, implements
from rating_app.application_schemas.course import Course as CourseDTO
from rating_app.application_schemas.course import CourseSpeciality
from rating_app.application_schemas.rating import Rating as RatingDTO
from rating_app.exception.course_exceptions import CourseMissingDepartmentOrFacultyError
from rating_app.models import Course
from rating_app.models.choices import CourseStatus, CourseTypeKind, RatingVoteType
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


ViewerId = str


# TODO: test theory: viewer ID is not needed for the mapper
class RatingMapper(IProcessor[[RatingModel, ViewerId | None], RatingDTO]):
    @implements
    def process(
        self,
        model: RatingModel,
        viewer_id: ViewerId | None = None,
    ) -> RatingDTO:
        student_id = model.student.id if not model.is_anonymous else None
        student_name = (
            f"{model.student.last_name} {model.student.first_name}"
            if not model.is_anonymous
            else None
        )

        # Compute vote counts from prefetched rating_vote
        upvotes = 0
        downvotes = 0
        viewer_vote = None

        if hasattr(model, "rating_vote"):
            votes = model.rating_vote.all()
            for vote in votes:
                if vote.type == RatingVoteType.UPVOTE.value:
                    upvotes += 1
                elif vote.type == RatingVoteType.DOWNVOTE.value:
                    downvotes += 1

                # Check if this is the viewer's vote
                if viewer_id and str(vote.student.id) == str(viewer_id):
                    viewer_vote = RatingVoteType(vote.type)

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
            viewer_vote=viewer_vote,
        )
