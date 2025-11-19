from typing import Any, Literal

from django.conf import settings

import structlog

from rating_app.models import Speciality, Student
from rating_app.models.choices import EducationLevel
from rating_app.repositories.protocol import IRepository

User = settings.AUTH_USER_MODEL

logger = structlog.get_logger()


class StudentRepository(IRepository[Student]):
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
        education_level: EducationLevel | Literal[""],
        speciality: Speciality,
        email: str = "",
    ) -> tuple[Student, bool]:
        student, created = Student.objects.get_or_create(
            first_name=first_name,
            last_name=last_name,
            patronymic=patronymic,
            education_level=education_level,
            speciality=speciality,
            defaults={"email": email},
        )
        if not created and email and not student.email:
            student.email = email
            student.save(update_fields=["email"])
        return student, created

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

    def filter(self, *args: Any, **kwargs: Any) -> list[Student]:
        #! TODO: not implemented
        return self.get_all()

    def get_by_email(self, email: str) -> Student | None:
        """Get a student by email that is not yet linked to a user."""
        try:
            return Student.objects.get(email=email, user__isnull=True)
        except Student.DoesNotExist:
            return None
        except Student.MultipleObjectsReturned:
            logger.warning("multiple_students_with_same_email", email=email)
            return None

    def link_to_user(self, student: Student, user) -> None:
        """Link a student to a user."""
        student.user = user
        student.save(update_fields=["user"])
