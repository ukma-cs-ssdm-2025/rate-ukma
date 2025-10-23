from django.conf import settings

import structlog

from rating_app.models import Speciality, Student
from rating_app.models.choices import EducationLevel

User = settings.AUTH_USER_MODEL

logger = structlog.get_logger()


class StudentRepository:
    def get_all(self) -> list[Student]:
        return list(Student.objects.select_related("speciality").all())

    def get_by_id(self, student_id: str) -> Student | None:
        try:
            return Student.objects.select_related("speciality").get(id=student_id)
        except Student.DoesNotExist:
            logger.error("student_not_found", student_id=student_id)
            return None

    def get_or_create(
        self,
        *,
        first_name: str,
        last_name: str,
        patronymic: str | None,
        education_level: EducationLevel,
        speciality: Speciality,
    ) -> tuple[Student, bool]:
        return Student.objects.get_or_create(
            first_name=first_name,
            last_name=last_name,
            patronymic=patronymic,
            education_level=education_level,
            speciality=speciality,
        )

    def create(self, **student_data) -> Student:
        return Student.objects.create(**student_data)

    def update(self, student: Student, **student_data) -> Student:
        for field, value in student_data.items():
            setattr(student, field, value)
        student.save()
        return student

    def delete(self, student: Student) -> None:
        student.delete()

    def create_user_for_student(self, student: Student, email: str | None = None) -> None:
        # To be implemented
        pass
