from typing import Literal, overload

from django.conf import settings
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import DataError
from django.db.models import QuerySet

import structlog

from rating_app.application_schemas.student import Student as StudentDTO
from rating_app.application_schemas.student import StudentInput
from rating_app.exception.student_exceptions import (
    InvalidStudentIdentifierError,
    StudentNotFoundError,
)
from rating_app.models import Student
from rating_app.repositories.protocol import IDomainOrmRepository
from rating_app.repositories.to_domain_mappers import StudentMapper

User = settings.AUTH_USER_MODEL

logger = structlog.get_logger(__name__)


class StudentRepository(IDomainOrmRepository[StudentDTO, Student]):
    def __init__(self, mapper: StudentMapper) -> None:
        self._mapper = mapper

    def get_all(self) -> list[StudentDTO]:
        qs = self._build_base_queryset().all()
        return self._map_to_domain_models(qs)

    def get_by_id(self, id: str) -> StudentDTO:
        model = self._get_by_id(id)
        return self._map_to_domain_model(model)

    def get_by_email(self, email: str) -> StudentDTO | None:
        """Get a student by email that is not yet linked to a user."""
        try:
            model = self._build_base_queryset().get(email=email, user__isnull=True)
            return self._map_to_domain_model(model)
        except Student.DoesNotExist:
            return None
        except Student.MultipleObjectsReturned:
            logger.warning("multiple_students_with_same_email", email=email)
            return None

    @overload
    def get_or_create(
        self,
        data: StudentInput | StudentDTO,
        *,
        return_model: Literal[False] = ...,
    ) -> tuple[StudentDTO, bool]: ...

    @overload
    def get_or_create(
        self,
        data: StudentInput | StudentDTO,
        *,
        return_model: Literal[True],
    ) -> tuple[Student, bool]: ...

    def get_or_create(
        self,
        data: StudentInput | StudentDTO,
        *,
        return_model: bool = False,
    ) -> tuple[StudentDTO, bool] | tuple[Student, bool]:
        model, created = Student.objects.get_or_create(
            first_name=data.first_name,
            last_name=data.last_name,
            patronymic=data.patronymic or "",
            education_level=data.education_level,
            speciality_id=data.speciality_id,
            defaults=self._build_defaults(data),
        )

        if not created and data.email and not model.email:
            model.email = data.email
            model.save(update_fields=["email"])

        if return_model:
            return model, created
        return self._map_to_domain_model(model), created

    @overload
    def get_or_upsert(
        self,
        data: StudentInput | StudentDTO,
        *,
        return_model: Literal[False] = ...,
    ) -> tuple[StudentDTO, bool]: ...

    @overload
    def get_or_upsert(
        self,
        data: StudentInput | StudentDTO,
        *,
        return_model: Literal[True],
    ) -> tuple[Student, bool]: ...

    def get_or_upsert(
        self,
        data: StudentInput | StudentDTO,
        *,
        return_model: bool = False,
    ) -> tuple[StudentDTO, bool] | tuple[Student, bool]:
        model, created = Student.objects.update_or_create(
            first_name=data.first_name,
            last_name=data.last_name,
            patronymic=data.patronymic or "",
            education_level=data.education_level,
            speciality_id=data.speciality_id,
            defaults=self._build_defaults(data),
        )

        if return_model:
            return model, created
        return self._map_to_domain_model(model), created

    def update(self, obj: StudentDTO, **student_data: object) -> StudentDTO:
        model = self._get_by_id(str(obj.id))
        for field, value in student_data.items():
            setattr(model, field, value)
        model.save()
        return self._map_to_domain_model(model)

    def delete(self, id: str) -> None:
        model = self._get_by_id(id)
        model.delete()

    def filter(self, **kwargs: object) -> list[StudentDTO]:
        # not used in filtering yet, returns all
        return self.get_all()

    def link_to_user(self, student_id: str, user) -> StudentDTO:
        """Link a student to a user."""
        model = self._get_by_id(student_id)
        model.user = user
        model.save(update_fields=["user"])
        return self._map_to_domain_model(model)

    def _build_defaults(self, data: StudentInput | StudentDTO) -> dict:
        return {
            "email": data.email or "",
        }

    def _get_by_id(self, id: str) -> Student:
        try:
            return self._build_base_queryset().get(id=id)
        except Student.DoesNotExist as exc:
            logger.warning("student_not_found", student_id=id, error=str(exc))
            raise StudentNotFoundError() from exc
        except (ValueError, TypeError, DjangoValidationError, DataError) as exc:
            logger.warning("invalid_student_identifier", student_id=id, error=str(exc))
            raise InvalidStudentIdentifierError() from exc

    def _build_base_queryset(self) -> QuerySet[Student]:
        return Student.objects.select_related("speciality")

    def _map_to_domain_models(self, qs: QuerySet[Student]) -> list[StudentDTO]:
        return [self._map_to_domain_model(model) for model in qs]

    def _map_to_domain_model(self, model: Student) -> StudentDTO:
        return self._mapper.process(model)
