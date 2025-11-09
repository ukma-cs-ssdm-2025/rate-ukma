class InstructorNotFoundError(Exception):
    def __init__(self, instructor_id: str):
        self.instructor_id = instructor_id
        message = f"Instructor with id {instructor_id} not found"
        super().__init__(message)
