from datetime import datetime

from rating_app.models import Semester
from rating_app.services.semester_service import SemesterService


class RatingWindowPolicy:
    def __init__(self, semester_service: SemesterService):
        self.semester_service = semester_service

    def is_semester_open_for_rating(
        self,
        semester: Semester,
        *,
        current_semester: Semester | None = None,
        current_date: datetime | None = None,
    ) -> bool:
        return self.semester_service.is_past_semester(
            semester, current_semester
        ) or self.semester_service.is_midpoint(semester, current_date)
