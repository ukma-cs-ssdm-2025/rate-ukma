from .analytics import AnalyticsViewSet
from .course_offering import CourseOfferingViewSet
from .course_viewset import CourseViewSet
from .instructor_viewset import InstructorViewSet
from .rating_viewset import RatingViewSet
from .student_viewset import StudentStatisticsViewSet
from .vote_viewset import RatingVoteViewSet

__all__ = [
    "CourseViewSet",
    "RatingViewSet",
    "InstructorViewSet",
    "AnalyticsViewSet",
    "StudentStatisticsViewSet",
    "CourseOfferingViewSet",
    "RatingVoteViewSet",
]
