from typing import Any

from rating_app.application_schemas.course import (
    Course as CourseDTO,
)
from rating_app.application_schemas.course import (
    CourseFilterCriteria,
    CourseSearchResult,
)
from rating_app.application_schemas.pagination import PaginationMetadata
from rating_app.constants import DEFAULT_COURSE_PAGE_SIZE
from rating_app.repositories import CourseRepository
from rating_app.services.paginator import QuerysetPaginator


class PaginationCourseAdapter:
    def __init__(self, course_repository: CourseRepository, paginator: QuerysetPaginator):
        self._course_repository = course_repository
        self._paginator = paginator

    def paginate(self, filters: CourseFilterCriteria) -> CourseSearchResult:
        courses_qs = self._course_repository.filter_qs(filters)

        # paginate
        page_size = filters.page_size or DEFAULT_COURSE_PAGE_SIZE
        result: tuple[list[Any], PaginationMetadata] = self._paginator.process(
            courses_qs, filters.page, page_size
        )
        page_courses, metadata = result

        # map to domain models
        items: list[CourseDTO] = self._course_repository.map_to_domain_models(page_courses)

        return CourseSearchResult(
            items=items,
            pagination=metadata,
            applied_filters=filters.model_dump(by_alias=True),
        )
