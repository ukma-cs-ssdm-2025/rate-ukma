from typing import Any

from django.db import IntegrityError
from django.db.models import Count, Q

import structlog

from rating_app.application_schemas.rating_vote import RatingVoteCreateSchema
from rating_app.exception.vote_exceptions import VoteAlreadyExistsException
from rating_app.models import RatingVote
from rating_app.models.choices import RatingVoteType
from rating_app.repositories.protocol import IRepository

logger = structlog.get_logger(__name__)


class RatingVoteRepository(IRepository[RatingVote]):
    def get_count_by_rating_id(self, rating_id: str) -> int:
        return (
            RatingVote.objects.select_related("student", "rating")
            .filter(rating_id=rating_id)
            .count()
        )

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

    def get_by_rating_id(self, rating_id: str) -> list[RatingVote]:
        return list(
            RatingVote.objects.select_related("student", "rating").filter(rating_id=rating_id)
        )

    def get_viewer_votes_by_rating_ids(
        self, student_id: str, rating_ids: list[str]
    ) -> dict[str, int]:
        qs = RatingVote.objects.filter(student_id=student_id, rating_id__in=rating_ids).values_list(
            "rating_id", "type"
        )
        return {str(rid): vote_type for rid, vote_type in qs}

    def create_vote(self, params: RatingVoteCreateSchema) -> RatingVote:
        try:
            return RatingVote.objects.create(
                type=params.vote_type, student_id=params.student_id, rating_id=params.rating_id
            )
        except IntegrityError as err:
            raise VoteAlreadyExistsException() from err

    def count_votes_of_type(self, rating_id: str, vote_type: str) -> int:
        return RatingVote.objects.filter(rating_id=rating_id, type=vote_type).count()

    def get_vote_by_student_and_rating(self, student_id: str, rating_id: str) -> RatingVote | None:
        try:
            return RatingVote.objects.get(student_id=student_id, rating_id=rating_id)
        except RatingVote.DoesNotExist:
            return None

    def get_all(self) -> list[RatingVote]:
        return list(RatingVote.objects.select_related("student", "rating").all())

    def get_by_id(self, id: str) -> RatingVote:
        return RatingVote.objects.select_related("student", "rating").get(pk=id)

    def filter(self, *args: Any, **kwargs: Any) -> list[RatingVote]:
        return list(RatingVote.objects.select_related("student", "rating").filter(*args, **kwargs))

    def get_or_create(self, **kwargs: Any) -> tuple[RatingVote, bool]:
        return RatingVote.objects.get_or_create(**kwargs)

    def update(self, obj: RatingVote, **kwargs: Any) -> RatingVote:
        for key, value in kwargs.items():
            setattr(obj, key, value)
        obj.save()
        return obj

    def delete(self, obj: RatingVote):
        obj.delete()
