from typing import cast

from django.core.paginator import Paginator
from django.db.models import QuerySet

import structlog

from rating_app.constants import DEFAULT_COURSE_PAGE_SIZE
from rating_app.domain_models.course import (
    CourseFilteredPayload,
    CourseFilterOptions,
    CourseQueryParams,
)
from rating_app.ioc_container.repos import (
    course_repository,
    department_repository,
    faculty_repository,
    instructor_repository,
    semester_repository,
    speciality_repository,
)
from rating_app.models import Course
from rating_app.models.choices import CourseTypeKind, SemesterTerm

logger = structlog.get_logger(__name__)


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

    def filter_courses(self, filters: CourseQueryParams) -> CourseFilteredPayload:
        courses = self.course_repository.filter(filters)
        return self._paginate_courses(courses, filters)

    # -- admin functions --
    def create_course(self, **course_data) -> Course:
        course, _ = self.course_repository.get_or_create(**course_data)
        return course

    def update_course(self, course_id, **update_data) -> Course:
        course = self.course_repository.get_by_id(course_id)
        return self.course_repository.update(course, **update_data)

    def delete_course(self, course_id) -> None:
        course = self.course_repository.get_by_id(course_id)
        self.course_repository.delete(course)

    def get_filter_options(self) -> CourseFilterOptions:
        instructors = self._get_sorted_instructors()
        faculties = self._get_sorted_faculties()
        departments = self._get_sorted_departments()
        specialities = self._get_sorted_specialities()

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

    def _get_sorted_instructors(self):
        return sorted(
            self.instructor_repository.get_all(),
            key=lambda instructor: (
                (instructor.last_name or "").lower(),
                (instructor.first_name or "").lower(),
            ),
        )

    def _get_sorted_faculties(self):
        return sorted(
            self.faculty_repository.get_all(),
            key=lambda faculty: (faculty.name or "").lower(),
        )

    def _get_sorted_departments(self):
        return sorted(
            self.department_repository.get_all(),
            key=lambda department: (department.name or "").lower(),
        )

    def _get_sorted_specialities(self):
        return sorted(
            self.speciality_repository.get_all(),
            key=lambda speciality: (speciality.name or "").lower(),
        )

    def _process_semesters(self):
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

        term_labels: dict[str, str] = {}
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
                term_labels[term] = label

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

    def _build_instructors_data(self, instructors):
        return [
            {
                "id": instructor.id,
                "name": f"{instructor.first_name} {instructor.last_name}",
                "department": None,
            }
            for instructor in instructors
        ]

    def _build_faculties_data(self, faculties):
        return [{"id": faculty.id, "name": faculty.name} for faculty in faculties]

    def _build_departments_data(self, departments):
        return [
            {
                "id": department.id,
                "name": department.name,
                "faculty_id": department.faculty_id,
                "faculty_name": department.faculty.name if department.faculty else None,
            }
            for department in departments
        ]

    def _build_specialities_data(self, specialities):
        return [
            {
                "id": speciality.id,
                "name": speciality.name,
                "faculty_id": speciality.faculty_id,
                "faculty_name": speciality.faculty.name if speciality.faculty else None,
            }
            for speciality in specialities
        ]

    def _paginate_courses(
        self, courses: QuerySet[Course], filters: CourseQueryParams
    ) -> CourseFilteredPayload:
        # TODO: handle situations where no pagination is required
        if not filters.page_size:
            all_courses_count = courses.count()
            filters.page_size = all_courses_count or DEFAULT_COURSE_PAGE_SIZE

        paginator = Paginator(courses, filters.page_size)
        page_obj = paginator.get_page(filters.page)

        total_pages = cast(int, paginator.num_pages)  # TODO: remove casting
        if not total_pages:
            total_pages = (cast(int, paginator.count) + filters.page_size - 1) // filters.page_size

        return CourseFilteredPayload(
            items=list(page_obj.object_list),
            page=page_obj.number,
            page_size=page_obj.paginator.per_page,
            total=cast(int, paginator.count),
            total_pages=total_pages,
            filters=filters.model_dump(),
        )
