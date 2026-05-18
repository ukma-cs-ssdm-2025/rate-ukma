import uuid
from typing import Literal, overload

from django.db.models import Count, Q, QuerySet

from rating_app.application_schemas.instructor import Instructor, InstructorInput
from rating_app.exception.instructor_exceptions import InstructorNotFoundError
from rating_app.models import Instructor as InstructorModel
from rating_app.repositories.protocol import IDomainOrmRepository
from rating_app.repositories.to_domain_mappers import InstructorMapper


class InstructorRepository(IDomainOrmRepository[Instructor, InstructorModel]):
    def __init__(self, mapper: InstructorMapper) -> None:
        self.mapper = mapper

    def get_all(self, *, ordered: bool = False) -> list[Instructor]:
        qs = InstructorModel.objects.all()
        if ordered:
            qs = qs.order_by("last_name", "first_name", "id")
        return self._map_to_domain_models(qs)

    def list_ranked(
        self,
        *,
        search: str | None = None,
        course_offering_id: uuid.UUID | None = None,
        speciality_id: uuid.UUID | None = None,
    ) -> QuerySet[InstructorModel]:
        """Annotate instructors with mention counts and order by relevance.

        Ordering: per-offering mentions DESC, per-speciality mentions DESC,
        global mentions DESC, last_name ASC, first_name ASC. Per-offering and
        per-speciality counts are zero when the corresponding filter is omitted.
        """
        offering_filter = (
            Q(ratings__course_offering_id=course_offering_id)
            if course_offering_id
            else Q(pk__in=[])
        )
        speciality_filter = (
            Q(ratings__course_offering__specialities__id=speciality_id)
            if speciality_id
            else Q(pk__in=[])
        )

        qs = InstructorModel.objects.annotate(
            offering_mentions=Count(
                "ratings",
                filter=offering_filter,
                distinct=True,
            ),
            speciality_mentions=Count(
                "ratings",
                filter=speciality_filter,
                distinct=True,
            ),
            global_mentions=Count("ratings", distinct=True),
        )

        if search:
            qs = qs.filter(
                Q(first_name__icontains=search)
                | Q(last_name__icontains=search)
                | Q(email__icontains=search)
            )

        return qs.order_by(
            "-offering_mentions",
            "-speciality_mentions",
            "-global_mentions",
            "last_name",
            "first_name",
            "id",
        )

    def get_many_by_ids(self, ids: list[uuid.UUID]) -> list[InstructorModel]:
        if not ids:
            return []
        return list(InstructorModel.objects.filter(id__in=ids))

    def get_by_id(self, id: str) -> Instructor:
        model = self._get_by_id(id)
        return self._map_to_domain_model(model)

    @overload
    def get_or_create(
        self,
        data: InstructorInput | Instructor,
        *,
        return_model: Literal[False] = ...,
    ) -> tuple[Instructor, bool]: ...

    @overload
    def get_or_create(
        self,
        data: InstructorInput | Instructor,
        *,
        return_model: Literal[True],
    ) -> tuple[InstructorModel, bool]: ...

    def get_or_create(
        self,
        data: InstructorInput | Instructor,
        *,
        return_model: bool = False,
    ) -> tuple[Instructor, bool] | tuple[InstructorModel, bool]:
        obj, created = InstructorModel.objects.get_or_create(
            email=data.email.lower(),
            defaults={
                "first_name": data.first_name,
                "last_name": data.last_name,
                "patronymic": data.patronymic or "",
            },
        )

        if return_model:
            return obj, created

        return self._map_to_domain_model(obj), created

    @overload
    def get_or_upsert(
        self,
        data: InstructorInput | Instructor,
        *,
        return_model: Literal[False] = ...,
    ) -> tuple[Instructor, bool]: ...

    @overload
    def get_or_upsert(
        self,
        data: InstructorInput | Instructor,
        *,
        return_model: Literal[True],
    ) -> tuple[InstructorModel, bool]: ...

    def get_or_upsert(
        self,
        data: InstructorInput | Instructor,
        *,
        return_model: bool = False,
    ) -> tuple[Instructor, bool] | tuple[InstructorModel, bool]:
        obj, created = InstructorModel.objects.update_or_create(
            email=data.email.lower(),
            defaults={
                "first_name": data.first_name,
                "last_name": data.last_name,
                "patronymic": data.patronymic or "",
            },
        )

        if return_model:
            return obj, created

        return self._map_to_domain_model(obj), created

    def create(self, **instructor_data) -> Instructor:
        obj = InstructorModel.objects.create(**instructor_data)
        return self._map_to_domain_model(obj)

    def update(self, obj: Instructor, **instructor_data) -> Instructor:
        model = self._get_by_id(str(obj.id))
        for field, value in instructor_data.items():
            setattr(model, field, value)
        model.save()
        return self._map_to_domain_model(model)

    def delete(self, id: str) -> None:
        model = self._get_by_id(id)
        model.delete()

    def filter(self, **kwargs: object) -> list[Instructor]:
        # not used in filtering yet, returns all
        return self.get_all()

    def _get_by_id(self, id: str) -> InstructorModel:
        try:
            return InstructorModel.objects.get(id=id)
        except InstructorModel.DoesNotExist as e:
            raise InstructorNotFoundError() from e

    def _map_to_domain_models(self, qs: QuerySet[InstructorModel]) -> list[Instructor]:
        return [self._map_to_domain_model(obj) for obj in qs]

    def _map_to_domain_model(self, obj: InstructorModel) -> Instructor:
        return self.mapper.process(obj)
