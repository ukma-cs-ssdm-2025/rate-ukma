from rest_framework.exceptions import NotFound


class StudentNotFoundError(NotFound):
    default_detail = "Student not found"
    default_code = "student_not_found"
