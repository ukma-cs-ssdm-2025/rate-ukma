from collections.abc import Sequence
from typing import TypeVar

from django.db import transaction

import structlog
from pydantic import BaseModel

from rateukma.protocols.decorators import implements
from rateukma.protocols.generic import IOperation
from rating_app.models.choices import EducationLevel
from rating_app.models.course import Course
from rating_app.models.faculty import Faculty
from rating_app.repositories import (
    CourseInstructorRepository,
    CourseOfferingRepository,
    CourseRepository,
    DepartmentRepository,
    EnrollmentRepository,
    FacultyRepository,
    InstructorRepository,
    SemesterRepository,
    SpecialityRepository,
    StudentRepository,
)
from scraper.services.db_ingestion.progress_tracker import InjectionProgressTracker

from ...models.deduplicated import (
    DeduplicatedCourse,
)

logger = structlog.get_logger(__name__)


_T = TypeVar("_T", bound=BaseModel, contravariant=True)


class IDbInjector(IOperation[[Sequence[_T]]]):
    _is_protocol = True

    def execute(self, models: Sequence[_T]) -> None: ...


class CourseDbInjector(IDbInjector):
    def __init__(
        self,
        course_repository: CourseRepository,
        department_repository: DepartmentRepository,
        faculty_repository: FacultyRepository,
        semester_repository: SemesterRepository,
        speciality_repository: SpecialityRepository,
        instructor_repository: InstructorRepository,
        student_repository: StudentRepository,
        course_offering_repository: CourseOfferingRepository,
        course_instructor_repository: CourseInstructorRepository,
        enrollment_repository: EnrollmentRepository,
        injection_progress_tracker: InjectionProgressTracker,
    ):
        self.course_repository = course_repository
        self.department_repository = department_repository
        self.faculty_repository = faculty_repository
        self.semester_repository = semester_repository
        self.speciality_repository = speciality_repository
        self.instructor_repository = instructor_repository
        self.student_repository = student_repository
        self.course_offering_repository = course_offering_repository
        self.course_instructor_repository = course_instructor_repository
        self.enrollment_repository = enrollment_repository
        self.tracker = injection_progress_tracker

    @transaction.atomic
    @implements
    def execute(self, models: Sequence[DeduplicatedCourse]) -> None:
        self.tracker.start(len(models))

        try:
            self._inject_to_db(models)
        except Exception as e:
            self.tracker.fail(str(e))
            return

        self.tracker.complete(f"{len(models)} courses")

    def _inject_to_db(self, models: Sequence[DeduplicatedCourse]) -> None:
        for course_data in models:
            self.tracker.increment()
            faculty = self._process_faculty(course_data)
            course = self._process_course(course_data, faculty)
            self._process_specialities(course, course_data)
            self._process_offerings(course, course_data)

    def _process_faculty(self, course_data: DeduplicatedCourse) -> Faculty:
        faculty, _ = self.faculty_repository.get_or_create(name=course_data.faculty)
        return faculty

    def _process_course(self, course_data: DeduplicatedCourse, faculty: Faculty) -> Course:
        department, _ = self.department_repository.get_or_create(
            name=course_data.department, faculty=faculty
        )
        course, _ = self.course_repository.get_or_create(
            title=course_data.title, department=department, status=course_data.status.value
        )
        return course

    def _process_specialities(
        self,
        course: Course,
        course_data: DeduplicatedCourse,
    ) -> None:
        for spec_data in course_data.specialities:
            speciality = self.speciality_repository.get_by_name(name=spec_data.name)
            if not speciality:
                speciality_faculty, _ = self.faculty_repository.get_or_create(
                    name=spec_data.faculty
                )
                speciality = self.speciality_repository.create(
                    name=spec_data.name,
                    faculty=speciality_faculty,
                )
            course.specialities.add(speciality)  # type: ignore

    def _process_offerings(
        self,
        course: Course,
        course_data: DeduplicatedCourse,
    ) -> None:
        for offering_data in course_data.offerings:
            semester, _ = self.semester_repository.get_or_create(
                year=offering_data.semester.year, term=offering_data.semester.term.value
            )

            course_offering, _ = self.course_offering_repository.get_or_create(
                course=course,
                semester=semester,
                code=offering_data.code,
                exam_type=offering_data.exam_type.value,
                practice_type=offering_data.practice_type.value
                if offering_data.practice_type
                else None,
                credits=offering_data.credits,
                weekly_hours=offering_data.weekly_hours,
                lecture_count=offering_data.lecture_count,
                practice_count=offering_data.practice_count,
                max_students=offering_data.max_students,
                max_groups=offering_data.max_groups,
                group_size_min=offering_data.group_size_min,
                group_size_max=offering_data.group_size_max,
            )
            for instructor_data in offering_data.instructors:
                instructor, _ = self.instructor_repository.get_or_create(
                    first_name=instructor_data.instructor.first_name,
                    last_name=instructor_data.instructor.last_name,
                    patronymic=instructor_data.instructor.patronymic,
                    academic_degree=instructor_data.instructor.academic_degree.value
                    if instructor_data.instructor.academic_degree
                    else None,
                    academic_title=instructor_data.instructor.academic_title.value
                    if instructor_data.instructor.academic_title
                    else None,
                )
                self.course_instructor_repository.get_or_create(
                    instructor=instructor,
                    course_offering=course_offering,
                    role=instructor_data.role.value,
                )
            for enrollment_data in offering_data.enrollments:
                student_data = enrollment_data.student
                education_level = student_data.education_level
                if not student_data.speciality:
                    continue

                student_faculty = self.faculty_repository.get_by_speciality_name(
                    student_data.speciality
                )
                student_speciality = self.speciality_repository.get_by_name(
                    name=student_data.speciality
                )
                if not student_speciality:
                    student_faculty = self.faculty_repository.get_by_speciality_name(
                        student_data.speciality
                    )
                    student_speciality, _ = self.speciality_repository.get_or_create(
                        name=student_data.speciality,
                        faculty=student_faculty,
                    )

                student, _ = self.student_repository.get_or_create(
                    first_name=enrollment_data.student.first_name,
                    last_name=enrollment_data.student.last_name,
                    patronymic=enrollment_data.student.patronymic,
                    education_level=EducationLevel(education_level),
                    speciality=student_speciality,
                )
                self.enrollment_repository.get_or_create(
                    student=student,
                    offering=course_offering,
                    status=enrollment_data.status.value,
                )
