from .course_service import CourseService
from .department_service import DepartmentService
from .faculty_service import FacultyService
from .instructor_service import InstructorService
from .rating_service import RatingService
from .semester_service import SemesterService
from .speciality_service import SpecialityService
from .student_service import StudentService

__all__ = [
    "CourseService",
    "RatingService",
    "InstructorService",
    "StudentService",
    "FacultyService",
    "DepartmentService",
    "SpecialityService",
    "SemesterService",
]
