from .course import Course
from .course_offering import CourseOffering
from .department import Department
from .enrollment import Enrollment
from .faculty import Faculty
from .instructor import Instructor
from .rating import Rating
from .semester import Semester
from .speciality import Speciality
from .student import Student

__all__ = [
    "Course",
    "Faculty",
    "Department",
    "Speciality",
    "Semester",
    "Instructor",
    "Student",
    "CourseOffering",
    "Enrollment",
    "Rating",
]
