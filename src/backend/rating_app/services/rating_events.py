from dataclasses import dataclass
from enum import StrEnum

from rating_app.application_schemas.rating import Rating as RatingDTO


class RatingAction(StrEnum):
    CREATED = "created"
    UPDATED = "updated"
    DELETED = "deleted"


@dataclass(frozen=True)
class RatingEvent:
    rating: RatingDTO
    action: RatingAction
