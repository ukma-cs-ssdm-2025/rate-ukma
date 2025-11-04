from rating_app.ioc_container.repositories import student_stats_repository


class StudentService:
    def __init__(self) -> None:
        self.student_stats_repo = student_stats_repository()

    def get_ratings(self, student_id: str):
        return self.student_stats_repo.get_rating_stats(student_id=student_id)

    def get_ratings_detail(self, student_id: str):
        return self.student_stats_repo.get_detailed_rating_stats(student_id=student_id)
