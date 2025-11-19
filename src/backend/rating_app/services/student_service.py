import structlog

from rating_app.models import Student
from rating_app.repositories import StudentRepository, StudentStatisticsRepository, UserRepository

logger = structlog.get_logger(__name__)


class StudentService:
    def __init__(
        self,
        student_stats_repository: StudentStatisticsRepository,
        student_repository: StudentRepository | None = None,
        user_repository: UserRepository | None = None,
    ) -> None:
        self.student_stats_repository = student_stats_repository
        self.student_repository = student_repository
        self.user_repository = user_repository

    def get_student_by_user_id(self, user_id: str):
        return self.student_stats_repository.get_student_by_user_id(user_id=user_id)

    def get_ratings(self, student_id: str):
        return self.student_stats_repository.get_rating_stats(student_id=student_id)

    def get_ratings_detail(self, student_id: str):
        return self.student_stats_repository.get_detailed_rating_stats(student_id=student_id)

    def link_student_to_user(self, student: Student) -> bool:
        if not student.email:
            return False

        if student.user is not None:
            return False

        user = self.user_repository.get_by_email(student.email)
        if not user:
            return False

        existing_student = getattr(user, "student_profile", None)
        if existing_student is not None:
            logger.warning(
                "user_already_linked_to_student",
                user_id=user.id,
                user_email=user.email,
                existing_student_id=str(existing_student.id),
                new_student_id=str(student.id),
            )
            return False

        self.student_repository.link_to_user(student, user)
        logger.info(
            "student_linked_to_user",
            student_id=str(student.id),
            user_id=user.id,
            email=student.email,
        )
        return True

    def link_user_to_student(self, user) -> bool:
        if not user.email:
            return False

        if getattr(user, "student_profile", None) is not None:
            return False

        student = self.student_repository.get_by_email(user.email)
        if not student:
            return False

        self.student_repository.link_to_user(student, user)
        logger.info(
            "user_linked_to_student",
            user_id=user.id,
            student_id=str(student.id),
            email=user.email,
        )
        return True
