import uuid
from dataclasses import dataclass

from pydantic import BaseModel, Field

from ..models.choices import RatingVoteStrType, RatingVoteType


@dataclass(frozen=True)
class RatingVote:
    id: uuid.UUID
    student_id: uuid.UUID
    rating_id: uuid.UUID
    vote_type: RatingVoteType | int


class RatingVoteCreateSchema(BaseModel):
    rating_id: str = Field(description="The unique identifier of the rating")
    student_id: str = Field(description="The unique identifier of the student")
    vote_type: RatingVoteStrType = Field(description="The type of the vote")


class RatingVoteCreateRequest(BaseModel):
    vote_type: RatingVoteStrType = Field(description="The type of the vote")
