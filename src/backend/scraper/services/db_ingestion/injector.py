from collections.abc import Sequence
from typing import TypeVar

from django.db import transaction

import structlog
from pydantic import BaseModel

from rateukma.protocols.decorators import implements
from rateukma.protocols.generic import IOperation
from rating_app.models import (
    Course,
    CourseInstructor,
    CourseOffering,
    Department,
    Enrollment,
    Faculty,
    Instructor,
    Semester,
    Speciality,
    Student,
)

from ...models.deduplicated import (
    DeduplicatedCourse,
    DeduplicatedCourseOffering,
    DeduplicatedEnrollment,
    EducationLevel,
)

logger = structlog.get_logger(__name__)


_T = TypeVar("_T", bound=BaseModel, contravariant=True)


class IDbInjector(IOperation[[Sequence[_T]]]):
    _is_protocol = True

    def execute(self, models: Sequence[_T]) -> None: ...


# TODO: this class will be refactored to use models repositories when they are available for reuse
class CourseDbInjector(IDbInjector):
    @transaction.atomic
    @implements
    def execute(self, models: Sequence[DeduplicatedCourse]) -> None:
        for course_data in models:
            faculty = self._get_or_create_faculty(course_data.faculty)
            department = self._get_or_create_department(course_data.department, faculty)

            course = self._get_or_create_course(
                course_data.title, department, course_data.status.value
            )

            for spec_data in course_data.specialities:
                speciality = self._get_or_create_speciality(
                    spec_data.name,
                    faculty,
                    spec_data.type.value if spec_data.type else EducationLevel.BACHELOR.value,
                )
                course.specialities.add(speciality)  # type: ignore

            for offering_data in course_data.offerings:
                semester = self._get_or_create_semester(
                    offering_data.semester.year, offering_data.semester.term.value
                )
                course_offering = self._get_or_create_course_offering(
                    course, semester, offering_data
                )

                for instructor_data in offering_data.instructors:
                    instructor = self._get_or_create_instructor(instructor_data.instructor)
                    self._get_or_create_course_instructor(
                        instructor, course_offering, instructor_data.role.value
                    )

                for enrollment_data in offering_data.enrollments:
                    student = self._get_or_create_student(
                        enrollment_data.student,
                        course_data.education_level.value
                        if course_data.education_level
                        else EducationLevel.BACHELOR.value,
                    )
                    self._get_or_create_enrollment(student, course_offering, enrollment_data)

            logger.info(
                "course_injected",
                course_id=str(course.id),
                title=course.title,
                department=department.name,
                specialities_count=len(course_data.specialities),
                offerings_count=len(course_data.offerings),
            )

    def _get_or_create_faculty(self, faculty_name: str) -> Faculty:
        faculty, _ = Faculty.objects.get_or_create(name=faculty_name)  # type: ignore
        return faculty

    def _get_or_create_department(self, department_name: str, faculty: Faculty) -> Department:
        department, _ = Department.objects.get_or_create(name=department_name, faculty=faculty)  # type: ignore
        return department

    def _get_or_create_speciality(
        self, speciality_name: str, faculty: Faculty, education_level: str
    ) -> Speciality:
        speciality, _ = Speciality.objects.get_or_create(  # type: ignore
            name=speciality_name,
            faculty=faculty,
            education_level=education_level,
        )
        return speciality

    def _get_or_create_course(
        self, course_title: str, department: Department, status: str
    ) -> Course:
        course, _ = Course.objects.get_or_create(  # type: ignore
            title=course_title,
            department=department,
            status=status,
        )
        return course

    def _get_or_create_semester(self, year: int, term: str) -> Semester:
        semester, _ = Semester.objects.get_or_create(year=year, term=term)  # type: ignore
        return semester

    def _get_or_create_instructor(self, instructor_data) -> Instructor:
        instructor, _ = Instructor.objects.get_or_create(  # type: ignore
            first_name=instructor_data.first_name,
            last_name=instructor_data.last_name,
            patronymic=instructor_data.patronymic,
            academic_degree=instructor_data.academic_degree.value
            if instructor_data.academic_degree
            else None,
            academic_title=instructor_data.academic_title.value
            if instructor_data.academic_title
            else None,
        )
        return instructor

    def _get_or_create_student(self, student_data, education_level: str) -> Student:
        student, _ = Student.objects.get_or_create(  # type: ignore
            first_name=student_data.first_name,
            last_name=student_data.last_name,
            patronymic=student_data.patronymic,
            education_level=education_level,
        )
        return student

    def _get_or_create_course_offering(
        self, course: Course, semester: Semester, course_offering_data: DeduplicatedCourseOffering
    ) -> CourseOffering:
        course_offering, _ = CourseOffering.objects.get_or_create(  # type: ignore
            course=course,
            semester=semester,
            code=course_offering_data.code,
            exam_type=course_offering_data.exam_type.value,
            practice_type=course_offering_data.practice_type.value
            if course_offering_data.practice_type
            else None,
            credits=course_offering_data.credits,
            weekly_hours=course_offering_data.weekly_hours,
            lecture_count=course_offering_data.lecture_count,
            practice_count=course_offering_data.practice_count,
            max_students=course_offering_data.max_students,
            max_groups=course_offering_data.max_groups,
            group_size_min=course_offering_data.group_size_min,
            group_size_max=course_offering_data.group_size_max,
        )
        return course_offering

    def _get_or_create_course_instructor(
        self, instructor: Instructor, course_offering: CourseOffering, role: str
    ) -> CourseInstructor:
        course_instructor, _ = CourseInstructor.objects.get_or_create(  # type: ignore
            instructor=instructor,
            course_offering=course_offering,
            role=role,
        )
        return course_instructor

    def _get_or_create_enrollment(
        self,
        student: Student,
        course_offering: CourseOffering,
        enrollment_data: DeduplicatedEnrollment,
    ) -> Enrollment:
        enrollment, _ = Enrollment.objects.get_or_create(  # type: ignore
            student=student,
            offering=course_offering,
            status=enrollment_data.status.value,
        )
        return enrollment
