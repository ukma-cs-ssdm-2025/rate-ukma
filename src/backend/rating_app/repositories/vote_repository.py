from typing import Literal, overload

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import DataError, IntegrityError
from django.db.models import Count, Q, QuerySet

import structlog

from rating_app.application_schemas.rating_vote import RatingVote as RatingVoteDTO
from rating_app.application_schemas.rating_vote import RatingVoteCreateSchema
from rating_app.exception.vote_exceptions import VoteAlreadyExistsException
from rating_app.models import RatingVote
from rating_app.models.choices import RatingVoteType
from rating_app.repositories.protocol import IDomainOrmRepository
from rating_app.repositories.to_domain_mappers import RatingVoteMapper, RatingVoteModelMapper

logger = structlog.get_logger(__name__)


class RatingVoteRepository(IDomainOrmRepository[RatingVoteDTO, RatingVote]):
    def __init__(
        self,
        vote_mapper: RatingVoteMapper,
        model_mapper: RatingVoteModelMapper | None = None,
    ) -> None:
        self.vote_mapper = vote_mapper
        self._model_mapper = model_mapper or RatingVoteModelMapper()

    def get_all(self) -> list[RatingVoteDTO]:
        qs = self._build_base_queryset().all()
        return self._map_to_domain_models(qs)

    def get_by_id(self, id: str) -> RatingVoteDTO:
        model = self._get_by_id(id)
        return self._map_to_domain_model(model)

    def filter(self, **kwargs: object) -> list[RatingVoteDTO]:
        qs = self._build_base_queryset().filter(**kwargs)
        return self._map_to_domain_models(qs)

    @overload
    def get_or_create(
        self,
        data: RatingVoteDTO,
        *,
        return_model: Literal[False] = ...,
    ) -> tuple[RatingVoteDTO, bool]: ...

    @overload
    def get_or_create(
        self,
        data: RatingVoteDTO,
        *,
        return_model: Literal[True],
    ) -> tuple[RatingVote, bool]: ...

    def get_or_create(
        self,
        data: RatingVoteDTO,
        *,
        return_model: bool = False,
    ) -> tuple[RatingVoteDTO, bool] | tuple[RatingVote, bool]:
        db_vote_type = self.vote_mapper.to_db(data.vote_type)
        model, created = RatingVote.objects.get_or_create(
            student_id=data.student_id,
            rating_id=data.rating_id,
            defaults={"type": db_vote_type},
        )

        if return_model:
            return model, created
        return self._map_to_domain_model(model), created

    @overload
    def get_or_upsert(
        self,
        data: RatingVoteDTO,
        *,
        return_model: Literal[False] = ...,
    ) -> tuple[RatingVoteDTO, bool]: ...

    @overload
    def get_or_upsert(
        self,
        data: RatingVoteDTO,
        *,
        return_model: Literal[True],
    ) -> tuple[RatingVote, bool]: ...

    def get_or_upsert(
        self,
        data: RatingVoteDTO,
        *,
        return_model: bool = False,
    ) -> tuple[RatingVoteDTO, bool] | tuple[RatingVote, bool]:
        db_vote_type = self.vote_mapper.to_db(data.vote_type)
        model, created = RatingVote.objects.update_or_create(
            student_id=data.student_id,
            rating_id=data.rating_id,
            defaults={"type": db_vote_type},
        )

        if return_model:
            return model, created
        return self._map_to_domain_model(model), created

    def update(self, obj: RatingVoteDTO, **kwargs: object) -> RatingVoteDTO:
        model = self._get_by_id(str(obj.id))
        for key, value in kwargs.items():
            setattr(model, key, value)
        model.save()
        return self._map_to_domain_model(model)

    def delete(self, id: str) -> None:
        model = self._get_by_id(id)
        model.delete()

    # Domain-specific methods

    def get_count_by_rating_id(self, rating_id: str) -> int:
        return self._build_base_queryset().filter(rating_id=rating_id).count()

    def get_vote_counts_by_rating_ids(self, rating_ids: list[str]) -> dict[str, dict[str, int]]:
        qs = (
            RatingVote.objects.filter(rating_id__in=rating_ids)
            .values("rating_id")
            .annotate(
                upvotes=Count("id", filter=Q(type=RatingVoteType.UPVOTE)),
                downvotes=Count("id", filter=Q(type=RatingVoteType.DOWNVOTE)),
            )
        )

        out: dict[str, dict[str, int]] = {}
        for row in qs:
            rid = str(row["rating_id"])
            out[rid] = {"upvotes": row["upvotes"], "downvotes": row["downvotes"]}
        return out

    def get_by_rating_id(self, rating_id: str) -> list[RatingVoteDTO]:
        qs = self._build_base_queryset().filter(rating_id=rating_id)
        return self._map_to_domain_models(qs)

    def get_viewer_votes_by_rating_ids(
        self, student_id: str, rating_ids: list[str]
    ) -> dict[str, int]:
        qs = RatingVote.objects.filter(student_id=student_id, rating_id__in=rating_ids).values_list(
            "rating_id", "type"
        )
        return {str(rid): vote_type for rid, vote_type in qs}

    def create_vote(self, params: RatingVoteCreateSchema) -> RatingVoteDTO:
        try:
            db_vote_type = self.vote_mapper.to_db(params.vote_type)
            model = RatingVote.objects.create(
                type=db_vote_type, student_id=params.student_id, rating_id=params.rating_id
            )
            return self._map_to_domain_model(model)
        except IntegrityError as err:
            raise VoteAlreadyExistsException() from err

    def count_votes_of_type(self, rating_id: str, vote_type: str) -> int:
        return RatingVote.objects.filter(rating_id=rating_id, type=vote_type).count()

    def get_vote_by_student_and_rating(
        self, student_id: str, rating_id: str
    ) -> RatingVoteDTO | None:
        try:
            model = RatingVote.objects.get(student_id=student_id, rating_id=rating_id)
            return self._map_to_domain_model(model)
        except RatingVote.DoesNotExist:
            return None

    def delete_vote_by_student_and_rating(self, student_id: str, rating_id: str) -> bool:
        """Delete a vote by student and rating. Returns True if deleted, False if not found."""
        try:
            model = RatingVote.objects.get(student_id=student_id, rating_id=rating_id)
            model.delete()
            return True
        except RatingVote.DoesNotExist:
            return False

    # Private helper methods

    def _get_by_id(self, id: str) -> RatingVote:
        try:
            return self._build_base_queryset().get(pk=id)
        except RatingVote.DoesNotExist as exc:
            logger.warning("rating_vote_not_found", vote_id=id, error=str(exc))
            raise
        except (ValueError, TypeError, DjangoValidationError, DataError) as exc:
            logger.warning("invalid_rating_vote_identifier", vote_id=id, error=str(exc))
            raise

    def _build_base_queryset(self) -> QuerySet[RatingVote]:
        return RatingVote.objects.select_related("student", "rating")

    def _map_to_domain_models(self, qs: QuerySet[RatingVote]) -> list[RatingVoteDTO]:
        return [self._map_to_domain_model(model) for model in qs]

    def _map_to_domain_model(self, model: RatingVote) -> RatingVoteDTO:
        return self._model_mapper.process(model)
