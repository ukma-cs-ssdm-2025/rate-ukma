class CourseNotFoundError(Exception):
    def __init__(self, course_id: str):
        self.course_id = course_id
        message = f"Course with id '{course_id}' was not found."
        super().__init__(message)


class InvalidCourseIdentifierError(Exception):
    def __init__(self, course_id: str):
        self.course_id = course_id
        message = f"Course id '{course_id}' is not a valid identifier."
        super().__init__(message)
