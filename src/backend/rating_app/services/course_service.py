from django.db.models import QuerySet

import structlog

from rating_app.application_schemas.course import (
    CourseFilterCriteria,
    CourseFilterOptions,
    CourseSearchResult,
)
from rating_app.application_schemas.pagination import PaginationMetadata
from rating_app.application_schemas.rating import AggregatedCourseRatingStats
from rating_app.constants import DEFAULT_COURSE_PAGE_SIZE
from rating_app.models import Course
from rating_app.models.choices import CourseTypeKind
from rating_app.repositories import CourseRepository
from rating_app.services.department_service import DepartmentService
from rating_app.services.faculty_service import FacultyService
from rating_app.services.instructor_service import InstructorService
from rating_app.services.paginator import QuerysetPaginator
from rating_app.services.semester_service import SemesterService
from rating_app.services.speciality_service import SpecialityService

logger = structlog.get_logger(__name__)


class CourseService:
    def __init__(
        self,
        course_repository: CourseRepository,
        paginator: QuerysetPaginator,
        instructor_service: InstructorService,
        faculty_service: FacultyService,
        department_service: DepartmentService,
        speciality_service: SpecialityService,
        semester_service: SemesterService,
    ):
        self.course_repository = course_repository
        self.paginator = paginator
        self.instructor_service = instructor_service
        self.faculty_service = faculty_service
        self.department_service = department_service
        self.speciality_service = speciality_service
        self.semester_service = semester_service

    def list_courses(self) -> list[Course]:
        return self.course_repository.get_all()

    def get_course(self, course_id: str) -> Course:
        return self.course_repository.get_by_id(course_id)

    def filter_courses(
        self, filters: CourseFilterCriteria, paginate: bool = True
    ) -> CourseSearchResult:
        courses = self.course_repository.filter(filters)

        if paginate:
            return self._paginated_result(courses, filters)

        return CourseSearchResult(
            items=list(courses),
            pagination=self._empty_pagination_metadata(courses.count()),
            applied_filters=filters.model_dump(by_alias=True),
        )

    # -- admin functions --
    def create_course(self, **course_data) -> Course:
        course, _ = self.course_repository.get_or_create(**course_data)
        return course

    def update_course(self, course_id: str, **update_data) -> Course | None:
        course = self.course_repository.get_by_id(course_id)
        if not course:
            return None
        return self.course_repository.update(course, **update_data)

    def update_course_aggregates(
        self, course: Course, aggregates: AggregatedCourseRatingStats
    ) -> Course:
        self.course_repository.update(
            course,
            avg_difficulty=aggregates.avg_difficulty,
            avg_usefulness=aggregates.avg_usefulness,
            ratings_count=aggregates.ratings_count,
        )
        return course

    def delete_course(self, course_id: str) -> None:
        course = self.course_repository.get_by_id(course_id)
        self.course_repository.delete(course)

    def get_filter_options(self) -> CourseFilterOptions:
        semester_filter_options = self.semester_service.get_filter_options()

        return CourseFilterOptions(
            instructors=self.instructor_service.get_filter_options(),
            faculties=self.faculty_service.get_filter_options(),
            departments=self.department_service.get_filter_options(),
            specialities=self.speciality_service.get_filter_options(),
            semester_terms=semester_filter_options["terms"],
            semester_years=semester_filter_options["years"],
            course_types=[
                {"value": str(value), "label": str(label)}
                for value, label in CourseTypeKind.choices
            ],
        )

    def _paginated_result(
        self, courses: QuerySet[Course], criteria: CourseFilterCriteria
    ) -> CourseSearchResult:
        page_size = criteria.page_size or DEFAULT_COURSE_PAGE_SIZE
        obj_list, metadata = self.paginator.process(courses, criteria.page, page_size)

        return CourseSearchResult(
            items=obj_list,
            pagination=metadata,
            applied_filters=criteria.model_dump(by_alias=True),
        )

    def _empty_pagination_metadata(self, courses_count: int) -> PaginationMetadata:
        return PaginationMetadata(
            page=1,
            page_size=courses_count,
            total=courses_count,
            total_pages=1,
        )
