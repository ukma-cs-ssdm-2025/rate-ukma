from typing import Any

from rating_app.filters import CourseFilterOptions, CourseFilterPayload, CourseFilters
from rating_app.ioc_container.repos import (
    course_repository,
    department_repository,
    faculty_repository,
    instructor_repository,
    semester_repository,
    speciality_repository,
)
from rating_app.models import Course, Faculty, Instructor
from rating_app.models.choices import CourseTypeKind, SemesterTerm
from rating_app.models.department import Department
from rating_app.models.speciality import Speciality


class CourseService:
    def __init__(self):
        self.course_repository = course_repository()
        self.instructor_repository = instructor_repository()
        self.faculty_repository = faculty_repository()
        self.department_repository = department_repository()
        self.semester_repository = semester_repository()
        self.speciality_repository = speciality_repository()

    def list_courses(self) -> list[Course]:
        return self.course_repository.get_all()

    def get_course(self, course_id) -> Course:
        return self.course_repository.get_by_id(course_id)

    def filter_courses(self, **kwargs) -> CourseFilterPayload:
        filters = CourseFilters.of(**kwargs)
        return self.course_repository.filter(filters)

    # -- admin functions --
    def create_course(self, **course_data: dict[str, Any]) -> Course:
        return self.course_repository.create(**course_data)

    def update_course(self, course_id: str, **update_data: dict[str, Any]) -> Course:
        course = self.course_repository.get_by_id(course_id)
        return self.course_repository.update(course, **update_data)

    def delete_course(self, course_id: str) -> None:
        course = self.course_repository.get_by_id(course_id)
        self.course_repository.delete(course)

    def get_filter_options(self) -> CourseFilterOptions:
        instructors: list[Instructor] = self._get_sorted_instructors()
        faculties: list[Faculty] = self._get_sorted_faculties()
        departments: list[Department] = self._get_sorted_departments()
        specialities: list[Speciality] = self._get_sorted_specialities()

        semester_terms, semester_years = self._process_semesters()
        course_types = [{"value": value, "label": label} for value, label in CourseTypeKind.choices]

        return CourseFilterOptions(
            instructors=self._build_instructors_data(instructors),
            faculties=self._build_faculties_data(faculties),
            departments=self._build_departments_data(departments),
            semester_terms=semester_terms,
            semester_years=semester_years,
            course_types=course_types,
            specialities=self._build_specialities_data(specialities),
        )

    def _get_sorted_instructors(self) -> list[Instructor]:
        return sorted(
            self.instructor_repository.get_all(),
            key=lambda instructor: (
                (instructor.last_name or "").lower(),
                (instructor.first_name or "").lower(),
            ),
        )

    def _get_sorted_faculties(self) -> list[Faculty]:
        return sorted(
            self.faculty_repository.get_all(),
            key=lambda faculty: (faculty.name or "").lower(),
        )

    def _get_sorted_departments(self) -> list[Department]:
        return sorted(
            self.department_repository.get_all(),
            key=lambda department: (department.name or "").lower(),
        )

    def _get_sorted_specialities(self) -> list[Speciality]:
        return sorted(
            self.speciality_repository.get_all(),
            key=lambda speciality: (speciality.name or "").lower(),
        )

    def _process_semesters(self) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
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

        term_labels: dict[SemesterTerm, str] = {}
        years: set[int] = set()
        for semester in sorted_semesters:
            year = getattr(semester, "year", None)
            term = getattr(semester, "term", None)
            if year is None or term is None:
                continue

            years.add(year)
            if term not in term_labels:
                label = (
                    SemesterTerm(term).label if term in SemesterTerm.values else str(term).title()
                )
                term_labels[SemesterTerm(term)] = label

        term_priority = {
            SemesterTerm.SPRING: 0,
            SemesterTerm.SUMMER: 1,
            SemesterTerm.FALL: 2,
        }
        semester_terms = [
            {"value": term, "label": term_labels[term]}
            for term in sorted(
                term_labels.keys(),
                key=lambda value: term_priority.get(value, len(term_priority)),
            )
        ]

        semester_years = [
            {"value": str(year), "label": str(year)} for year in sorted(years, reverse=True)
        ]

        return semester_terms, semester_years

    def _build_instructors_data(self, instructors: list[Instructor]) -> list[dict[str, Any]]:
        return [
            {
                "id": instructor.id,
                "name": f"{instructor.first_name} {instructor.last_name}",
                "department": None,
            }
            for instructor in instructors
        ]

    def _build_faculties_data(self, faculties: list[Faculty]) -> list[dict[str, Any]]:
        return [{"id": faculty.id, "name": faculty.name} for faculty in faculties]

    def _build_departments_data(self, departments: list[Department]) -> list[dict[str, Any]]:
        return [
            {
                "id": department.id,
                "name": department.name,
                "faculty_id": department.faculty_id,
                "faculty_name": department.faculty.name if department.faculty else None,
            }
            for department in departments
        ]

    def _build_specialities_data(self, specialities: list[Speciality]) -> list[dict[str, Any]]:
        return [
            {
                "id": speciality.id,
                "name": speciality.name,
                "faculty_id": speciality.faculty_id,
                "faculty_name": speciality.faculty.name if speciality.faculty else None,
            }
            for speciality in specialities
        ]
