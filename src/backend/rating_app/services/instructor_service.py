import uuid
from typing import Any

from rating_app.application_schemas.instructor import (
    CourseInstructorMentions,
    CourseInstructorsQueryParams,
    Instructor,
    InstructorListParams,
    InstructorListResult,
)
from rating_app.application_schemas.pagination import PaginationFilters
from rating_app.pagination.paginator import GenericQuerysetPaginator
from rating_app.repositories import InstructorRepository
from rating_app.repositories.to_domain_mappers import InstructorMapper
from rating_app.services.protocols import IFilterable


class InstructorService(IFilterable):
    def __init__(
        self,
        instructor_repository: InstructorRepository,
        mapper: InstructorMapper,
        paginator: GenericQuerysetPaginator,
    ):
        self.instructor_repository = instructor_repository
        self.mapper = mapper
        self.paginator = paginator

    def get_instructor_by_id(self, instructor_id: str) -> Instructor:
        return self.instructor_repository.get_by_id(instructor_id)

    def list_instructors(self, params: InstructorListParams) -> InstructorListResult:
        qs = self.instructor_repository.list_ranked(
            search=params.search,
            course_offering_id=params.course_offering_id,
            course_id=params.course_id,
            speciality_id=params.speciality_id,
            mentioned_only=params.mentioned_only,
        )
        paginated = self.paginator.process(
            qs,
            PaginationFilters(page=params.page, page_size=params.page_size),
        )
        items = [self.mapper.process(obj) for obj in paginated.page_objects]
        return InstructorListResult(items=items, pagination=paginated.metadata)

    def list_course_instructors(
        self, course_id: uuid.UUID, params: CourseInstructorsQueryParams
    ) -> list[CourseInstructorMentions]:
        qs = self.instructor_repository.mentioned_on_course(
            course_id=course_id, offering_id=params.offering_id
        )
        return [
            CourseInstructorMentions(
                instructor=self.mapper.process(obj),
                ratings_count=obj.ratings_count,  # pyright: ignore[reportAttributeAccessIssue]  # queryset annotation
                offering_ratings_count=obj.offering_ratings_count,  # pyright: ignore[reportAttributeAccessIssue]  # queryset annotation
            )
            for obj in qs
        ]

    def get_filter_options(self) -> list[dict[str, Any]]:
        instructors = self.instructor_repository.get_all(ordered=True)
        return [
            {
                "id": instructor.id,
                "name": f"{instructor.first_name} {instructor.last_name}",
                "department": None,
            }
            for instructor in instructors
        ]
