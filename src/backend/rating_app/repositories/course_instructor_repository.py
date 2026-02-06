from typing import Literal, overload

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import DataError
from django.db.models import QuerySet

import structlog

from rating_app.application_schemas.course_instructor import (
    CourseInstructor as CourseInstructorDTO,
)
from rating_app.application_schemas.course_instructor import CourseInstructorInput
from rating_app.exception.course_instructor_exceptions import (
    CourseInstructorNotFoundError,
    InvalidCourseInstructorIdentifierError,
)
from rating_app.models import CourseInstructor
from rating_app.repositories.protocol import IDomainOrmRepository
from rating_app.repositories.to_domain_mappers import CourseInstructorMapper

logger = structlog.get_logger(__name__)


class CourseInstructorRepository(IDomainOrmRepository[CourseInstructorDTO, CourseInstructor]):
    def __init__(self, mapper: CourseInstructorMapper) -> None:
        self._mapper = mapper

    def get_all(self) -> list[CourseInstructorDTO]:
        qs = self._build_base_queryset().all()
        return self._map_to_domain_models(qs)

    def get_by_id(self, id: str) -> CourseInstructorDTO:
        model = self._get_by_id(id)
        return self._map_to_domain_model(model)

    @overload
    def get_or_create(
        self,
        data: CourseInstructorInput | CourseInstructorDTO,
        *,
        return_model: Literal[False] = ...,
    ) -> tuple[CourseInstructorDTO, bool]: ...

    @overload
    def get_or_create(
        self,
        data: CourseInstructorInput | CourseInstructorDTO,
        *,
        return_model: Literal[True],
    ) -> tuple[CourseInstructor, bool]: ...

    def get_or_create(
        self,
        data: CourseInstructorInput | CourseInstructorDTO,
        *,
        return_model: bool = False,
    ) -> tuple[CourseInstructorDTO, bool] | tuple[CourseInstructor, bool]:
        model, created = CourseInstructor.objects.get_or_create(
            instructor_id=data.instructor_id,
            course_offering_id=data.course_offering_id,
            role=data.role,
        )

        if return_model:
            return model, created
        return self._map_to_domain_model(model), created

    @overload
    def get_or_upsert(
        self,
        data: CourseInstructorInput | CourseInstructorDTO,
        *,
        return_model: Literal[False] = ...,
    ) -> tuple[CourseInstructorDTO, bool]: ...

    @overload
    def get_or_upsert(
        self,
        data: CourseInstructorInput | CourseInstructorDTO,
        *,
        return_model: Literal[True],
    ) -> tuple[CourseInstructor, bool]: ...

    def get_or_upsert(
        self,
        data: CourseInstructorInput | CourseInstructorDTO,
        *,
        return_model: bool = False,
    ) -> tuple[CourseInstructorDTO, bool] | tuple[CourseInstructor, bool]:
        model, created = CourseInstructor.objects.update_or_create(
            instructor_id=data.instructor_id,
            course_offering_id=data.course_offering_id,
            defaults={"role": data.role},
        )

        if return_model:
            return model, created
        return self._map_to_domain_model(model), created

    def update(self, obj: CourseInstructorDTO, **ci_data: object) -> CourseInstructorDTO:
        model = self._get_by_id(str(obj.id))
        for field, value in ci_data.items():
            setattr(model, field, value)
        model.save()
        return self._map_to_domain_model(model)

    def delete(self, id: str) -> None:
        model = self._get_by_id(id)
        model.delete()

    def filter(self, **kwargs: object) -> list[CourseInstructorDTO]:
        return self.get_all()

    def _get_by_id(self, id: str) -> CourseInstructor:
        try:
            return self._build_base_queryset().get(id=id)
        except CourseInstructor.DoesNotExist as exc:
            logger.warning("course_instructor_not_found", course_instructor_id=id, error=str(exc))
            raise CourseInstructorNotFoundError() from exc
        except (ValueError, TypeError, DjangoValidationError, DataError) as exc:
            logger.warning(
                "invalid_course_instructor_identifier", course_instructor_id=id, error=str(exc)
            )
            raise InvalidCourseInstructorIdentifierError() from exc

    def _build_base_queryset(self) -> QuerySet[CourseInstructor]:
        return CourseInstructor.objects.select_related("instructor", "course_offering")

    def _map_to_domain_models(
        self, qs: QuerySet[CourseInstructor] | list[CourseInstructor]
    ) -> list[CourseInstructorDTO]:
        return [self._map_to_domain_model(model) for model in qs]

    def _map_to_domain_model(self, model: CourseInstructor) -> CourseInstructorDTO:
        return self._mapper.process(model)
