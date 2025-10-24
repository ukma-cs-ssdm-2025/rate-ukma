from rating_app.exception.instructor_exceptions import InstructorNotFoundError
from rating_app.ioc_container.repos import instructor_repository
from rating_app.models import Instructor


class InstructorService:
    def __init__(self):
        self.instructor_repository = instructor_repository()

    def get_instructor_by_id(self, instructor_id):
        try:
            return self.instructor_repository.get_by_id(instructor_id)
        except Instructor.DoesNotExist:
            raise InstructorNotFoundError(f"Instructor with id {instructor_id} not found") from None
