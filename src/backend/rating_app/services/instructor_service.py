from rating_app.ioc_container.repos import instructor_repository


class InstructorService:
    def __init__(self):
        self.instructor_repository = instructor_repository()

    def get_instructor_by_id(self, instructor_id):
        return self.instructor_repository.get_by_id(instructor_id)
