from ..filters import CourseFilterPayload, CourseFilters
from ..ioc_container.repositories import course_repository
from ..models import Course


class CourseService:
    def __init__(self):
        self.course_repository = course_repository()

    def list_courses(self) -> list[Course]:
        return self.course_repository.get_all()

    def get_course(self, course_id) -> Course:
        return self.course_repository.get_by_id(course_id)

    def filter_courses(self, filters: CourseFilters) -> CourseFilterPayload:
        return self.course_repository.filter(filters)

    # -- admin functions --
    def create_course(self, **course_data) -> Course:
        return self.course_repository.create(**course_data)

    def update_course(self, course_id, **update_data) -> Course:
        course = self.course_repository.get_by_id(course_id)
        return self.course_repository.update(course, **update_data)

    def delete_course(self, course_id) -> None:
        course = self.course_repository.get_by_id(course_id)
        self.course_repository.delete(course)
