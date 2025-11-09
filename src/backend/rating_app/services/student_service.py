from rating_app.repositories import StudentStatisticsRepository


class StudentService:
    def __init__(self, student_stats_repository: StudentStatisticsRepository) -> None:
        self.student_stats_repository = student_stats_repository

    def get_ratings(self, student_id: str):
        return self.student_stats_repository.get_rating_stats(student_id=student_id)

    def get_ratings_detail(self, student_id: str):
        return self.student_stats_repository.get_detailed_rating_stats(student_id=student_id)
