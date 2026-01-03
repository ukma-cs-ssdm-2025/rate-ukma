from pydantic import BaseModel, Field

from ..models.choices import RatingVoteType


class RatingVoteCreateSchema(BaseModel):
    rating_id: str = Field(description="The unique identifier of the rating")
    student_id: str = Field(description="The unique identifier of the student")
    vote_type: RatingVoteType = Field(description="The type of the vote")


class RatingVoteCreateRequest(BaseModel):
    vote_type: RatingVoteType = Field(description="The type of the vote")
