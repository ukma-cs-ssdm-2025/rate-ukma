from .course_instructor_repository import CourseInstructorRepository
from .course_offering_repository import CourseOfferingRepository
from .course_repository import CourseRepository
from .department_repository import DepartmentRepository
from .enrollment_repository import EnrollmentRepository
from .faculty_repository import FacultyRepository
from .instructor_repository import InstructorRepository
from .semester_repository import SemesterRepository
from .speciality_repository import SpecialityRepository
from .student_repository import StudentRepository

__all__ = [
    "CourseRepository",
    "FacultyRepository",
    "DepartmentRepository",
    "SpecialityRepository",
    "SemesterRepository",
    "InstructorRepository",
    "StudentRepository",
    "CourseOfferingRepository",
    "CourseInstructorRepository",
    "EnrollmentRepository",
]
