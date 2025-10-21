from typing import Any

from ..models import Course
from ..repositories.course_repository import CourseRepository


class CourseService:
    def __init__(self, course_repository: CourseRepository):
        self.course_repository = course_repository

    def list_courses(self) -> list[Course]:
        return self.course_repository.get_all()

    def get_course(self, course_id) -> Course:
        return self.course_repository.get_by_id(course_id)

    def filter_courses(
        self,
        *,
        page: int,
        page_size: int,
        name: str | None = None,
        type_kind: str | None = None,
        instructor: str | None = None,
        faculty: str | None = None,
        department: str | None = None,
        semester_year: int | None = None,
        semester_term: str | None = None,
        speciality: str | None = None,
        avg_difficulty_order: str | None = None,
        avg_usefulness_order: str | None = None,
    ) -> dict[str, Any]:
        return self.course_repository.filter(
            name=name,
            type_kind=type_kind,
            instructor=instructor,
            faculty=faculty,
            department=department,
            semester_year=semester_year,
            semester_term=semester_term,
            speciality=speciality,
            avg_difficulty_order=avg_difficulty_order,
            avg_usefulness_order=avg_usefulness_order,
            page_size=page_size,
            page_number=page,
        )

    # -- admin functions --
    def create_course(self, **course_data) -> Course:
        return self.course_repository.create(**course_data)

    def update_course(self, course_id, **update_data) -> Course:
        course = self.course_repository.get_by_id(course_id)
        return self.course_repository.update(course, **update_data)

    def delete_course(self, course_id) -> None:
        course = self.course_repository.get_by_id(course_id)
        self.course_repository.delete(course)
