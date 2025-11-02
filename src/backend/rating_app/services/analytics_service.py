from ..models import Course
from ..repositories import DepartmentRepository
from ..serializers.analytics import CourseAnalyticsDTO
from .course_service import CourseService


class AnalyticsService:
    def __init__(self, course_service: CourseService, department_repository: DepartmentRepository):
        self.course_service = course_service
        self.department_repository = department_repository

    def get_analytics(self):
        courses = self.course_service.list_courses()

        return [
            CourseAnalyticsDTO(
                id=str(course.id),
                avg_usefulness=course.avg_usefulness,
                avg_difficulty=course.avg_difficulty,
                ratings_count=course.ratings_count or 0,
                name=str(course.title),
                faculty_name=self._get_faculty_name(course),
            )
            for course in courses
        ]

    def _get_faculty_name(self, course: Course) -> str | None:
        faculty = self.course_service.get_faculty(course)
        if not faculty:
            return None

        return str(faculty.name)
