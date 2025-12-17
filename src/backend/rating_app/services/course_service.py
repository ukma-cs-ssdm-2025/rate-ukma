from django.db.models import QuerySet

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
from rating_app.constants import DEFAULT_COURSE_PAGE_SIZE
from rating_app.models import Course as CourseModel
from rating_app.models.choices import CourseTypeKind
from rating_app.repositories import CourseRepository
from rating_app.services.department_service import DepartmentService
from rating_app.services.django_mappers import CourseModelMapper
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
        course_model_mapper: CourseModelMapper,
    ):
        self.course_repository = course_repository
        self.paginator = paginator
        self.instructor_service = instructor_service
        self.faculty_service = faculty_service
        self.department_service = department_service
        self.speciality_service = speciality_service
        self.semester_service = semester_service
        self.course_model_mapper = course_model_mapper

    @rcached(ttl=86400)  # 24 hours - list of courses rarely changes
    def list_courses(self) -> list[CourseModel]:
        return self.course_repository.get_all()

    @rcached(ttl=300)
    def get_course(self, course_id: str) -> CourseModel:
        return self.course_repository.get_by_id(course_id)

    @rcached(ttl=300)
    def filter_courses(
        self, filters: CourseFilterCriteria, paginate: bool = True
    ) -> CourseSearchResult:
        courses = self.course_repository.filter(filters)

        if paginate:
            return self._paginated_result(courses, filters)

        return self._build_search_result(list(courses), filters)

    # -- admin functions --
    def create_course(self, **course_data) -> CourseModel:
        course, _ = self.course_repository.get_or_create(**course_data)
        return course

    def update_course(self, course_id: str, **update_data) -> CourseModel | None:
        course = self.course_repository.get_by_id(course_id)
        if not course:
            return None
        return self.course_repository.update(course, **update_data)

    def update_course_aggregates(
        self, course: CourseModel, aggregates: AggregatedCourseRatingStats
    ) -> CourseModel:
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

    def _paginated_result(
        self, courses: QuerySet[CourseModel], criteria: CourseFilterCriteria
    ) -> CourseSearchResult:
        page_size = criteria.page_size or DEFAULT_COURSE_PAGE_SIZE
        result: tuple[list[CourseModel], PaginationMetadata] = self.paginator.process(
            courses, criteria.page, page_size
        )
        page_courses, metadata = result
        return self._build_search_result(page_courses, criteria, metadata)

    def _empty_pagination_metadata(self, courses_count: int) -> PaginationMetadata:
        return PaginationMetadata(
            page=1,
            page_size=courses_count,
            total=courses_count,
            total_pages=1,
        )

    def _build_search_result(
        self,
        courses: list[CourseModel],
        criteria: CourseFilterCriteria,
        pagination: PaginationMetadata | None = None,
    ) -> CourseSearchResult:
        items: list[CourseDTO] = [self.course_model_mapper.map_to_dto(course) for course in courses]
        return CourseSearchResult(
            items=items,
            pagination=pagination or self._empty_pagination_metadata(len(items)),
            applied_filters=criteria.model_dump(by_alias=True),
        )
