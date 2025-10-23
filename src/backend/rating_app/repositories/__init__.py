from .course_instructor_repository import CourseInstructorRepository
from .course_offering_repository import CourseOfferingRepository
from .course_repository import CourseRepository
from .department_repository import DepartmentRepository
from .enrollment_repository import EnrollmentRepository
from .faculty_repository import FacultyRepository
from .rating_repository import RatingRepository
from .semester_repository import SemesterRepository
from .speciality_repository import SpecialityRepository
from .student_repository import StudentRepository

__all__ = [
    "CourseRepository",
    "FacultyRepository",
    "DepartmentRepository",
    "SpecialityRepository",
    "SemesterRepository",
    "StudentRepository",
    "CourseOfferingRepository",
    "CourseInstructorRepository",
    "CourseRepository",
    "RatingRepository",
    "EnrollmentRepository",
]
