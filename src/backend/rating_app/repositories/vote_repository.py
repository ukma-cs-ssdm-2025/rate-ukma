from typing import Any

from django.db import IntegrityError

import structlog

from rating_app.application_schemas.rating_vote import RatingVoteCreateSchema
from rating_app.exception.vote_exceptions import VoteAlreadyExistsException
from rating_app.models import RatingVote
from rating_app.repositories.protocol import IRepository

logger = structlog.get_logger(__name__)


class RatingVoteRepository(IRepository[RatingVote]):
    def get_count_by_rating_id(self, rating_id: str) -> int:
        return (
            RatingVote.objects.select_related("student", "rating")
            .filter(rating_id=rating_id)
            .count()
        )

    def get_by_rating_id(self, rating_id: str) -> list[RatingVote]:
        return list(
            RatingVote.objects.select_related("student", "rating").filter(rating_id=rating_id)
        )

    def create_vote(self, params: RatingVoteCreateSchema) -> RatingVote:
        try:
            return RatingVote.objects.create(
                type=params.vote_type, student_id=params.student_id, rating_id=params.rating_id
            )
        except IntegrityError as err:
            raise VoteAlreadyExistsException() from err

    def delete_vote(self, vote: RatingVote) -> None:
        RatingVote.objects.filter(student=vote.student, rating=vote.rating).delete()

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

    def delete(self, vote: RatingVote) -> bool:
        deleted, _ = RatingVote.objects.filter(pk=vote.pk).delete()
        return deleted > 0
