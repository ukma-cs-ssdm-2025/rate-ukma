import structlog

from rateukma.caching.decorators import rcached
from rating_app.application_schemas.course import (
    Course as CourseDTO,
)
from rating_app.application_schemas.course import (
    CourseFilterCriteria,
    CourseFilterOptions,
    CourseSearchResult,
)
from rating_app.application_schemas.pagination import PaginationMetadata
from rating_app.application_schemas.rating import AggregatedCourseRatingStats
from rating_app.exception.course_exceptions import (
    CourseNotFoundError,
    InvalidCourseIdentifierError,
)
from rating_app.models.choices import CourseTypeKind
from rating_app.repositories.course_repository import CourseRepository
from rating_app.services.department_service import DepartmentService
from rating_app.services.faculty_service import FacultyService
from rating_app.services.instructor_service import InstructorService
from rating_app.services.pagination_course_adapter import PaginationCourseAdapter
from rating_app.services.semester_service import SemesterService
from rating_app.services.speciality_service import SpecialityService

logger = structlog.get_logger(__name__)


class CourseService:
    def __init__(
        self,
        pagination_course_adapter: PaginationCourseAdapter,
        course_repository: CourseRepository,
        instructor_service: InstructorService,
        faculty_service: FacultyService,
        department_service: DepartmentService,
        speciality_service: SpecialityService,
        semester_service: SemesterService,
    ):
        self.pagination_course_adapter = pagination_course_adapter
        self.course_repository = course_repository
        self.instructor_service = instructor_service
        self.faculty_service = faculty_service
        self.department_service = department_service
        self.speciality_service = speciality_service
        self.semester_service = semester_service

    @rcached(ttl=86400)  # 24 hours - list of courses rarely changes
    def list_courses(self, prefetch_related: bool = True) -> list[CourseDTO]:
        return self.course_repository.get_all(prefetch_related=prefetch_related)

    @rcached(ttl=300)
    def get_course(self, course_id: str, prefetch_related: bool = True) -> CourseDTO:
        return self.course_repository.get_by_id(course_id, prefetch_related=prefetch_related)

    @rcached(ttl=300)
    def filter_courses(
        self, filters: CourseFilterCriteria, paginate: bool = True
    ) -> CourseSearchResult:
        if paginate:
            return self.pagination_course_adapter.paginate(filters)

        courses = self.course_repository.filter(filters)

        return CourseSearchResult(
            items=courses,
            pagination=self._empty_pagination_metadata(len(courses)),
            applied_filters=filters.model_dump(by_alias=True),
        )

    def update_course_aggregates(
        self, course: CourseDTO, aggregates: AggregatedCourseRatingStats
    ) -> None:
        self.course_repository.update(
            course,
            avg_difficulty=aggregates.avg_difficulty,
            avg_usefulness=aggregates.avg_usefulness,
            ratings_count=aggregates.ratings_count,
        )

    @rcached(ttl=86400)  # 24 hours - filter options rarely change
    def get_filter_options(self) -> CourseFilterOptions:
        semester_filter_options = self.semester_service.get_filter_options()

        faculties = self.faculty_service.get_filter_options()
        departments = self.department_service.get_filter_options()
        specialities = self.speciality_service.get_filter_options()

        for faculty in faculties:
            faculty_departments = [
                {"id": dept["id"], "name": dept["name"]}
                for dept in departments
                if dept["faculty_id"] == faculty["id"]
            ]
            faculty["departments"] = faculty_departments

            faculty_specialitites = [
                {"id": spec["id"], "name": spec["name"]}
                for spec in specialities
                if spec["faculty_id"] == faculty["id"]
            ]
            faculty["specialities"] = faculty_specialitites

        return CourseFilterOptions(
            instructors=self.instructor_service.get_filter_options(),
            faculties=faculties,
            semester_terms=semester_filter_options["terms"],
            semester_years=semester_filter_options["years"],
            course_types=[
                {"value": str(value), "label": str(label)}
                for value, label in CourseTypeKind.choices
            ],
        )

    # -- admin functions --
    # TODO: invalidate cache for courses
    def create_course(self, **course_data) -> CourseDTO:
        course, _ = self.course_repository.get_or_create(**course_data)
        return course

    def update_course(self, course_id: str, **update_data) -> CourseDTO | None:
        try:
            course_dto = self.course_repository.get_by_id(course_id)
            return self.course_repository.update(course_dto, **update_data)
        except (CourseNotFoundError, InvalidCourseIdentifierError) as exc:
            logger.error("error_updating_course", course_id=course_id, error=str(exc))
            return None

    def delete_course(self, course_id: str) -> None:
        try:
            course_dto = self.course_repository.get_by_id(course_id)
            self.course_repository.delete(course_dto)
        except (CourseNotFoundError, InvalidCourseIdentifierError) as exc:
            logger.error("error_deleting_course", course_id=course_id, error=str(exc))

    def _empty_pagination_metadata(self, courses_count: int) -> PaginationMetadata:
        return PaginationMetadata(
            page=1,
            page_size=courses_count,
            total=courses_count,
            total_pages=1,
        )
