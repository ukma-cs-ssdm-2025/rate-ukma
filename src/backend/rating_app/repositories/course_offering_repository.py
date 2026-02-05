from typing import Literal, overload
from uuid import UUID

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import DataError
from django.db.models.query import QuerySet

import structlog

from rating_app.application_schemas.course_offering import CourseOffering as CourseOfferingDTO
from rating_app.exception.course_exceptions import (
    CourseOfferingNotFoundError,
    InvalidCourseOfferingIdentifierError,
)
from rating_app.models import CourseOffering
from rating_app.repositories.protocol import IDomainOrmRepository
from rating_app.repositories.to_domain_mappers import CourseOfferingMapper

logger = structlog.get_logger(__name__)


class CourseOfferingRepository(IDomainOrmRepository[CourseOfferingDTO, CourseOffering]):
    def __init__(self, mapper: CourseOfferingMapper) -> None:
        self._mapper = mapper

    def get_all(self) -> list[CourseOfferingDTO]:
        qs = self._build_base_queryset().all()
        return self._map_to_domain_models(qs)

    def get_by_id(self, id: str) -> CourseOfferingDTO:
        model = self._get_by_id(id)
        return self._map_to_domain_model(model)

    def get_by_course(self, course_id: str | UUID) -> list[CourseOfferingDTO]:
        qs = self._build_base_queryset().filter(course_id=course_id)
        return self._map_to_domain_models(qs)

    @overload
    def get_or_create(
        self,
        data: CourseOfferingDTO,
        *,
        return_model: Literal[False] = ...,
    ) -> tuple[CourseOfferingDTO, bool]: ...

    @overload
    def get_or_create(
        self,
        data: CourseOfferingDTO,
        *,
        return_model: Literal[True],
    ) -> tuple[CourseOffering, bool]: ...

    def get_or_create(
        self,
        data: CourseOfferingDTO,
        *,
        return_model: bool = False,
    ) -> tuple[CourseOfferingDTO, bool] | tuple[CourseOffering, bool]:
        model, created = CourseOffering.objects.get_or_create(
            code=data.code,
            defaults=self._build_defaults(data),
        )

        if return_model:
            return model, created
        return self._map_to_domain_model(model), created

    @overload
    def get_or_upsert(
        self,
        data: CourseOfferingDTO,
        *,
        return_model: Literal[False] = ...,
    ) -> tuple[CourseOfferingDTO, bool]: ...

    @overload
    def get_or_upsert(
        self,
        data: CourseOfferingDTO,
        *,
        return_model: Literal[True],
    ) -> tuple[CourseOffering, bool]: ...

    def get_or_upsert(
        self,
        data: CourseOfferingDTO,
        *,
        return_model: bool = False,
    ) -> tuple[CourseOfferingDTO, bool] | tuple[CourseOffering, bool]:
        model, created = CourseOffering.objects.update_or_create(
            code=data.code,
            defaults=self._build_defaults(data),
        )

        if return_model:
            return model, created
        return self._map_to_domain_model(model), created

    def create(self, data: CourseOfferingDTO) -> CourseOfferingDTO:
        model = CourseOffering.objects.create(
            code=data.code,
            course_id=data.course_id,
            semester_id=data.semester_id,
            exam_type=data.exam_type,
            practice_type=data.practice_type or "",
            credits=data.credits,
            weekly_hours=data.weekly_hours,
            lecture_count=data.lecture_count,
            practice_count=data.practice_count,
            max_students=data.max_students,
            max_groups=data.max_groups,
            group_size_min=data.group_size_min,
            group_size_max=data.group_size_max,
        )
        return self._map_to_domain_model(model)

    def update(self, obj: CourseOfferingDTO, **offering_data: object) -> CourseOfferingDTO:
        model = self._get_by_id(str(obj.id))
        for field, value in offering_data.items():
            setattr(model, field, value)
        model.save()
        return self._map_to_domain_model(model)

    def delete(self, id: str) -> None:
        model = self._get_by_id(id)
        model.delete()

    def filter(self, **kwargs: object) -> list[CourseOfferingDTO]:
        # not used in filtering yet, returns all
        return self.get_all()

    def _build_defaults(self, data: CourseOfferingDTO) -> dict:
        return {
            "course_id": data.course_id,
            "semester_id": data.semester_id,
            "exam_type": data.exam_type,
            "practice_type": data.practice_type or "",
            "credits": data.credits,
            "weekly_hours": data.weekly_hours,
            "lecture_count": data.lecture_count,
            "practice_count": data.practice_count,
            "max_students": data.max_students,
            "max_groups": data.max_groups,
            "group_size_min": data.group_size_min,
            "group_size_max": data.group_size_max,
        }

    def _get_by_id(self, id: str) -> CourseOffering:
        try:
            return self._build_base_queryset().get(id=id)
        except CourseOffering.DoesNotExist as exc:
            logger.warning("course_offering_not_found", course_offering_id=id, error=str(exc))
            raise CourseOfferingNotFoundError() from exc
        except (ValueError, TypeError, DjangoValidationError, DataError) as exc:
            logger.warning(
                "invalid_course_offering_identifier", course_offering_id=id, error=str(exc)
            )
            raise InvalidCourseOfferingIdentifierError() from exc

    def _build_base_queryset(self) -> QuerySet[CourseOffering]:
        return CourseOffering.objects.select_related("course", "semester").prefetch_related(
            "instructors"
        )

    def _map_to_domain_models(
        self, qs: QuerySet[CourseOffering] | list[CourseOffering]
    ) -> list[CourseOfferingDTO]:
        return [self._map_to_domain_model(model) for model in qs]

    def _map_to_domain_model(self, model: CourseOffering) -> CourseOfferingDTO:
        return self._mapper.process(model)
