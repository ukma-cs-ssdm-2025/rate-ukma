from collections.abc import Sequence
from typing import TypeVar

from django.db import transaction

import structlog
from pydantic import BaseModel

from rateukma.protocols.decorators import implements
from rateukma.protocols.generic import IOperation
from rating_app.models import (
    Course,
    CourseOffering,
    Department,
    Faculty,
    Instructor,
    Semester,
    Speciality,
    Student,
)
from rating_app.models.choices import EducationLevel
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
    DeduplicatedCourseInstructor,
    DeduplicatedCourseOffering,
    DeduplicatedEnrollment,
    DeduplicatedInstructor,
    DeduplicatedStudent,
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

        self._faculty_cache: dict[str, Faculty] = {}
        self._department_cache: dict[tuple[str, str], Department] = {}
        self._course_cache: dict[tuple[str, str], Course] = {}
        self._speciality_cache: dict[str, Speciality | None] = {}
        self._semester_cache: dict[tuple[int, str], Semester] = {}
        self._instructor_cache: dict[tuple[str, str, str, str, str], Instructor] = {}
        self._student_cache: dict[tuple[str, str, str, str, str], Student] = {}
        self._batch_number: int | None = None

    @transaction.atomic
    @implements
    def execute(self, models: Sequence[DeduplicatedCourse]) -> None:
        self.tracker.start(len(models))

        try:
            self._inject_to_db(models)
        except Exception as e:
            self.tracker.fail(str(e))
            raise e

        self.tracker.complete()

    def reset_state(self) -> None:
        self._reset_caches()
        self._batch_number = None

    def set_batch_number(self, batch_number: int) -> None:
        self._batch_number = batch_number
        if hasattr(self.tracker, "set_batch_number"):
            self.tracker.set_batch_number(batch_number)

    def _reset_caches(self) -> None:
        self._faculty_cache.clear()
        self._department_cache.clear()
        self._course_cache.clear()
        self._speciality_cache.clear()
        self._semester_cache.clear()
        self._instructor_cache.clear()
        self._student_cache.clear()

    def _inject_to_db(self, models: Sequence[DeduplicatedCourse]) -> None:
        for course_data in models:
            self.tracker.increment()
            faculty = self._process_faculty(course_data)
            course = self._process_course(course_data, faculty)
            self._process_specialities(course, course_data)
            self._process_offerings(course, course_data)

    def _process_faculty(self, course_data: DeduplicatedCourse) -> Faculty:
        faculty_name = course_data.faculty
        cached = self._faculty_cache.get(faculty_name)
        if cached:
            return cached

        faculty, _ = self.faculty_repository.get_or_create(name=faculty_name)
        self._faculty_cache[faculty_name] = faculty
        return faculty

    def _process_course(self, course_data: DeduplicatedCourse, faculty: Faculty) -> Course:
        department_key = (course_data.department, faculty.name)
        department = self._department_cache.get(department_key)
        if not department:
            department, _ = self.department_repository.get_or_create(
                name=course_data.department,
                faculty=faculty,
            )
            self._department_cache[department_key] = department

        course_key = (course_data.title, department.name)
        course = self._course_cache.get(course_key)
        if not course:
            course, _ = self.course_repository.get_or_create(
                title=course_data.title,
                department=department,
                status=course_data.status.value,
                description=course_data.description,
            )
            self._course_cache[course_key] = course

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
                self._speciality_cache[spec_data.name] = speciality
            course.specialities.add(speciality)  # type: ignore

    def _process_offerings(
        self,
        course: Course,
        course_data: DeduplicatedCourse,
    ) -> None:
        for offering_data in course_data.offerings:
            course_offering = self._create_course_offering(course, offering_data)
            self._process_instructors_m2m(course_offering, offering_data.instructors)
            self._process_enrollments(course_offering, offering_data.enrollments)

    def _create_course_offering(
        self,
        course: Course,
        offering_data: DeduplicatedCourseOffering,
    ) -> CourseOffering:
        semester_key = (offering_data.semester.year, offering_data.semester.term.value)
        semester = self._semester_cache.get(semester_key)
        if not semester:
            semester, _ = self.semester_repository.get_or_create(
                year=offering_data.semester.year,
                term=offering_data.semester.term.value,
            )
            self._semester_cache[semester_key] = semester

        course_offering, _ = self.course_offering_repository.get_or_upsert(
            course=course,
            semester=semester,
            code=offering_data.code,
            exam_type=offering_data.exam_type.value,
            practice_type=offering_data.practice_type.value if offering_data.practice_type else "",
            credits=offering_data.credits,
            weekly_hours=offering_data.weekly_hours,
            lecture_count=offering_data.lecture_count,
            practice_count=offering_data.practice_count,
            max_students=offering_data.max_students,
            max_groups=offering_data.max_groups,
            group_size_min=offering_data.group_size_min,
            group_size_max=offering_data.group_size_max,
        )
        return course_offering

    def _process_instructors_m2m(
        self,
        course_offering: CourseOffering,
        instructors_data: Sequence[DeduplicatedCourseInstructor],
    ) -> None:
        for instructor_data in instructors_data:
            instructor = self._create_instructor(instructor_data.instructor)
            self.course_instructor_repository.get_or_create(
                instructor=instructor,
                course_offering=course_offering,
                role=instructor_data.role.value,
            )

    def _create_instructor(self, instructor_data: DeduplicatedInstructor) -> Instructor:
        key = (
            instructor_data.first_name,
            instructor_data.last_name,
            instructor_data.patronymic or "",
            instructor_data.academic_degree.value if instructor_data.academic_degree else "",
            instructor_data.academic_title.value if instructor_data.academic_title else "",
        )
        cached = self._instructor_cache.get(key)
        if cached:
            return cached

        instructor, _ = self.instructor_repository.get_or_create(
            first_name=instructor_data.first_name,
            last_name=instructor_data.last_name,
            patronymic=instructor_data.patronymic or "",
            academic_degree=instructor_data.academic_degree.value
            if instructor_data.academic_degree
            else "",
            academic_title=instructor_data.academic_title.value
            if instructor_data.academic_title
            else "",
        )
        self._instructor_cache[key] = instructor
        return instructor

    def _process_enrollments(
        self,
        course_offering: CourseOffering,
        enrollments_data: Sequence[DeduplicatedEnrollment],
    ) -> None:
        for enrollment_data in enrollments_data:
            student = self._create_student(enrollment_data.student)
            if not student:
                continue

            self.enrollment_repository.get_or_upsert(
                student=student,
                offering=course_offering,
                status=enrollment_data.status.value,
            )

    def _create_student(self, student_data: DeduplicatedStudent) -> Student | None:
        if not student_data.speciality:
            return None

        student_speciality = self._get_or_create_speciality(student_data.speciality)
        if not student_speciality:
            return None

        education_level = ""
        if student_data.education_level:
            education_level = EducationLevel(student_data.education_level)

        key = (
            student_data.first_name,
            student_data.last_name,
            student_data.patronymic or "",
            str(education_level),
            student_speciality.name,
        )
        cached = self._student_cache.get(key)
        if cached:
            return cached

        student, _ = self.student_repository.get_or_create(
            first_name=student_data.first_name,
            last_name=student_data.last_name,
            patronymic=student_data.patronymic or "",
            education_level=education_level,
            speciality=student_speciality,
        )
        self._student_cache[key] = student
        return student

    def _get_or_create_speciality(self, speciality_name: str) -> Speciality | None:
        cached = self._speciality_cache.get(speciality_name)
        if cached is not None:
            return cached

        speciality = self.speciality_repository.get_by_name(name=speciality_name)
        if speciality:
            self._speciality_cache[speciality_name] = speciality
            return speciality

        faculty = self.faculty_repository.get_by_speciality_name(speciality_name)
        if not faculty:
            self._speciality_cache[speciality_name] = None
            return None

        speciality, _ = self.speciality_repository.get_or_create(
            name=speciality_name,
            faculty=faculty,
        )
        self._speciality_cache[speciality_name] = speciality
        return speciality
