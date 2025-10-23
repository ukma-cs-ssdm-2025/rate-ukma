from rateukma.ioc.decorators import once

from ..repositories import (
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


@once
def course_repository() -> CourseRepository:
    return CourseRepository()


@once
def department_repository() -> DepartmentRepository:
    return DepartmentRepository()


@once
def faculty_repository() -> FacultyRepository:
    return FacultyRepository()


@once
def semester_repository() -> SemesterRepository:
    return SemesterRepository()


@once
def speciality_repository() -> SpecialityRepository:
    return SpecialityRepository()


@once
def instructor_repository() -> InstructorRepository:
    return InstructorRepository()


@once
def student_repository() -> StudentRepository:
    return StudentRepository()


@once
def course_offering_repository() -> CourseOfferingRepository:
    return CourseOfferingRepository()


@once
def course_instructor_repository() -> CourseInstructorRepository:
    return CourseInstructorRepository()


@once
def enrollment_repository() -> EnrollmentRepository:
    return EnrollmentRepository()
