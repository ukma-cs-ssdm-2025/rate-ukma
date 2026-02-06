from typing import Literal, overload

from django.db.models import QuerySet

from rating_app.application_schemas.enrollment import Enrollment as EnrollmentDTO
from rating_app.application_schemas.enrollment import EnrollmentInput
from rating_app.exception.enrollment_exceptions import EnrollmentNotFoundError
from rating_app.models import Enrollment
from rating_app.models.choices import EnrollmentStatus
from rating_app.repositories.protocol import IDomainOrmRepository
from rating_app.repositories.to_domain_mappers import EnrollmentMapper


class EnrollmentRepository(IDomainOrmRepository[EnrollmentDTO, Enrollment]):
    def __init__(self, mapper: EnrollmentMapper) -> None:
        self._mapper = mapper

    def get_all(self) -> list[EnrollmentDTO]:
        qs = self._build_base_queryset().all()
        return self._map_to_domain_models(qs)

    def get_by_id(self, id: str) -> EnrollmentDTO:
        model = self._get_by_id(id)
        return self._map_to_domain_model(model)

    @overload
    def get_or_create(
        self,
        data: EnrollmentInput | EnrollmentDTO,
        *,
        return_model: Literal[False] = ...,
    ) -> tuple[EnrollmentDTO, bool]: ...

    @overload
    def get_or_create(
        self,
        data: EnrollmentInput | EnrollmentDTO,
        *,
        return_model: Literal[True],
    ) -> tuple[Enrollment, bool]: ...

    def get_or_create(
        self,
        data: EnrollmentInput | EnrollmentDTO,
        *,
        return_model: bool = False,
    ) -> tuple[EnrollmentDTO, bool] | tuple[Enrollment, bool]:
        model, created = Enrollment.objects.get_or_create(
            student_id=data.student_id,
            offering_id=data.offering_id,
            defaults={"status": data.status},
        )

        if return_model:
            return model, created
        return self._map_to_domain_model(model), created

    @overload
    def get_or_upsert(
        self,
        data: EnrollmentInput | EnrollmentDTO,
        *,
        return_model: Literal[False] = ...,
    ) -> tuple[EnrollmentDTO, bool]: ...

    @overload
    def get_or_upsert(
        self,
        data: EnrollmentInput | EnrollmentDTO,
        *,
        return_model: Literal[True],
    ) -> tuple[Enrollment, bool]: ...

    def get_or_upsert(
        self,
        data: EnrollmentInput | EnrollmentDTO,
        *,
        return_model: bool = False,
    ) -> tuple[EnrollmentDTO, bool] | tuple[Enrollment, bool]:
        model, created = Enrollment.objects.update_or_create(
            student_id=data.student_id,
            offering_id=data.offering_id,
            defaults={"status": data.status},
        )

        if return_model:
            return model, created
        return self._map_to_domain_model(model), created

    def update(self, obj: EnrollmentDTO, **enrollment_data: object) -> EnrollmentDTO:
        model = self._get_by_id(str(obj.id))
        for field, value in enrollment_data.items():
            setattr(model, field, value)
        model.save()
        return self._map_to_domain_model(model)

    def delete(self, id: str) -> None:
        model = self._get_by_id(id)
        model.delete()

    def filter(self, **kwargs: object) -> list[EnrollmentDTO]:
        return self.get_all()

    def is_student_enrolled(self, student_id: str, offering_id: str) -> bool:
        return Enrollment.objects.filter(
            student_id=student_id,
            offering_id=offering_id,
            status__in=[EnrollmentStatus.ENROLLED, EnrollmentStatus.FORCED],
        ).exists()

    def is_student_enrolled_in_course(self, student_id: str, course_id: str) -> bool:
        return Enrollment.objects.filter(
            student_id=student_id,
            offering__course_id=course_id,
            status__in=[EnrollmentStatus.ENROLLED, EnrollmentStatus.FORCED],
        ).exists()

    def _get_by_id(self, id: str) -> Enrollment:
        try:
            return self._build_base_queryset().get(id=id)
        except Enrollment.DoesNotExist as e:
            raise EnrollmentNotFoundError() from e

    def _build_base_queryset(self) -> QuerySet[Enrollment]:
        return Enrollment.objects.select_related(
            "student__speciality", "offering__course", "offering__semester"
        )

    def _map_to_domain_models(
        self, qs: QuerySet[Enrollment] | list[Enrollment]
    ) -> list[EnrollmentDTO]:
        return [self._map_to_domain_model(model) for model in qs]

    def _map_to_domain_model(self, model: Enrollment) -> EnrollmentDTO:
        return self._mapper.process(model)
