from .course import Course
from .course_instructor import CourseInstructor
from .course_offering import CourseOffering
from .course_speciality import CourseSpeciality
from .department import Department
from .enrollment import Enrollment
from .faculty import Faculty
from .instructor import Instructor
from .person import Person
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
    "CourseInstructor",
    "CourseSpeciality",
    "Enrollment",
    "Rating",
    "Person",
]
