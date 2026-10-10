from datetime import datetime
from typing import Any

import structlog

from rateukma.caching.decorators import rcached
from rateukma.caching.patterns import student_ratings_namespace
from rating_app.application_schemas.semester import SemesterInput
from rating_app.application_schemas.student import Student as StudentDTO
from rating_app.repositories import StudentRepository, StudentStatisticsRepository, UserRepository
from rating_app.services.rating_service import RatingService
from rating_app.services.rating_suggestions import (
    RatingSuggestion,
    SuggestionSemester,
    rank_rating_suggestions,
)
from rating_app.services.semester_service import SemesterService

logger = structlog.get_logger(__name__)


class StudentService:
    def __init__(
        self,
        student_stats_repository: StudentStatisticsRepository,
        student_repository: StudentRepository,
        semester_service: SemesterService,
        user_repository: UserRepository,
        rating_service: RatingService,
    ) -> None:
        self.student_stats_repository = student_stats_repository
        self.student_repository = student_repository
        self.semester_service = semester_service
        self.user_repository = user_repository
        self.rating_service = rating_service

    def get_student_by_user_id(self, user_id: str) -> StudentDTO:
        return self.student_stats_repository.get_student_by_user_id(user_id=user_id)

    def get_by_id(self, student_id: str) -> StudentDTO:
        return self.student_repository.get_by_id(id=student_id)

    @rcached(ttl=3600, versioned_by=lambda self, student_id: student_ratings_namespace(student_id))
    def get_ratings(self, student_id: str) -> list[dict[str, Any]]:
        courses = self.student_stats_repository.get_rating_stats(student_id=student_id)
        current_semester = self.semester_service.get_current()
        now = datetime.now()
        for course in courses:
            for offering in course["offerings"]:
                course_semester = SemesterInput(
                    year=offering["year"],
                    term=offering["season"],
                )
                # forbid rating future courses
                offering["can_rate"] = self.rating_service.is_semester_open_for_rating(
                    course_semester, current_semester=current_semester, current_date=now
                )

        return courses

    @rcached(ttl=3600, versioned_by=lambda self, student_id: student_ratings_namespace(student_id))
    def get_ratings_detail(self, student_id: str) -> list[dict[str, Any]]:
        result = self.student_stats_repository.get_detailed_rating_stats(student_id=student_id)
        current_semester = self.semester_service.get_current()
        now = datetime.now()
        for course in result:
            course_semester = SemesterInput(
                year=course["semester"]["year"], term=course["semester"]["season"]
            )
            course["can_rate"] = self.rating_service.is_semester_open_for_rating(
                course_semester, current_semester=current_semester, current_date=now
            )
        return result

    def get_rating_suggestions(
        self, student_id: str, exclude_course: str | None = None
    ) -> list[RatingSuggestion]:
        eligible = [
            item
            for item in self.get_ratings_detail(student_id)
            if item["can_rate"] and not item["rated"]
        ]
        counts = self.student_stats_repository.get_course_rating_counts(
            [item["course_id"] for item in eligible]
        )
        candidates = [
            RatingSuggestion(
                course_id=item["course_id"],
                course_offering_id=item["course_offering_id"],
                course_title=item["course_title"],
                semester=SuggestionSemester(
                    year=item["semester"]["year"], season=item["semester"]["season"]
                ),
                ratings_count=counts[item["course_id"]],
            )
            for item in eligible
            if item["course_id"] in counts
        ]
        return rank_rating_suggestions(candidates, exclude_course)

    def link_student_to_user(self, student: StudentDTO) -> bool:
        if not student.email:
            return False

        if student.user_id is not None:
            return False

        user = self.user_repository.get_by_email(str(student.email))
        if not user:
            return False

        existing_student = getattr(user, "student_profile", None)
        if existing_student is not None:
            logger.warning(
                "user_already_linked_to_student",
                user_id=user.pk,
                user_email=user.email,
                existing_student_id=str(existing_student.id),
                new_student_id=str(student.id),
            )
            return False

        self.student_repository.link_to_user(str(student.id), user)
        logger.info(
            "student_linked_to_user",
            student_id=str(student.id),
            user_id=user.pk,
            email=student.email,
        )
        return True

    def link_user_to_student(self, user) -> bool:
        if not user.email:
            return False

        if getattr(user, "student_profile", None) is not None:
            return False

        student = self.student_repository.get_by_email(str(user.email))
        if not student:
            return False

        self.student_repository.link_to_user(str(student.id), user)
        logger.info(
            "user_linked_to_student",
            user_id=user.id,
            student_id=str(student.id),
            email=user.email,
        )
        return True
