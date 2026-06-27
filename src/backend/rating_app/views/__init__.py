from .analytics import AnalyticsViewSet
from .comment_viewset import CommentViewset
from .course_offering import CourseOfferingViewSet
from .course_viewset import CourseViewSet
from .flags_viewset import FlagsViewSet
from .instructor_viewset import InstructorViewSet
from .notification_viewset import NotificationViewSet
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
    "CommentViewset",
    "NotificationViewSet",
    "FlagsViewSet",
]
