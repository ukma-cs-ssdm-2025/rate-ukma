from typing import Any

from rating_app.filters import CourseFilterPayload, CourseFilters
from rating_app.ioc_container.repos import (
    course_repository,
    department_repository,
    faculty_repository,
    instructor_repository,
    semester_repository,
)
from rating_app.models import Course
from rating_app.models.choices import CourseTypeKind, SemesterTerm


class CourseService:
    def __init__(self):
        self.course_repository = course_repository()
        self.instructor_repository = instructor_repository()
        self.faculty_repository = faculty_repository()
        self.department_repository = department_repository()
        self.semester_repository = semester_repository()

    def list_courses(self) -> list[Course]:
        return self.course_repository.get_all()

    def get_course(self, course_id) -> Course:
        return self.course_repository.get_by_id(course_id)

    def filter_courses(self, **kwargs) -> CourseFilterPayload:
        filters = CourseFilters.of(**kwargs)
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

    def get_filter_options(self) -> dict[str, list[dict[str, Any]]]:
        instructors = sorted(
            self.instructor_repository.get_all(),
            key=lambda instructor: (
                (instructor.last_name or "").lower(),
                (instructor.first_name or "").lower(),
            ),
        )
        faculties = sorted(
            self.faculty_repository.get_all(),
            key=lambda faculty: (faculty.name or "").lower(),
        )
        departments = sorted(
            self.department_repository.get_all(),
            key=lambda department: (department.name or "").lower(),
        )
        semesters = self.semester_repository.get_all()

        semester_term_order = {value: index for index, value in enumerate(SemesterTerm.values)}
        sorted_semesters = sorted(
            semesters,
            key=lambda semester: (
                getattr(semester, "year", 0) or 0,
                semester_term_order.get(getattr(semester, "term", None), -1),
            ),
            reverse=True,
        )

        semester_options = []
        for semester in sorted_semesters:
            year = getattr(semester, "year", None)
            term = getattr(semester, "term", None)
            if year is None or term is None:
                continue

            label = SemesterTerm(term).label if term in SemesterTerm.values else term

            semester_options.append(
                {
                    "id": f"{year}-{term}",
                    "year": year,
                    "term": term,
                    "label": f"{year} {label}",
                }
            )

        course_types = [{"value": value, "label": label} for value, label in CourseTypeKind.choices]

        return {
            "instructors": [
                {
                    "id": instructor.id,
                    "name": f"{instructor.first_name} {instructor.last_name}",
                    "department": None,
                }
                for instructor in instructors
            ],
            "faculties": [{"id": faculty.id, "name": faculty.name} for faculty in faculties],
            "departments": [
                {
                    "id": department.id,
                    "name": department.name,
                    "faculty_id": department.faculty_id,
                    "faculty_name": department.faculty.name if department.faculty else None,
                }
                for department in departments
            ],
            "semesters": semester_options,
            "course_types": course_types,
        }
