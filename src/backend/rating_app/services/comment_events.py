from dataclasses import dataclass
from enum import StrEnum

from rating_app.application_schemas.comment import CommentDTO


class CommentAction(StrEnum):
    CREATED = "created"
    UPDATED = "updated"
    DELETED = "deleted"


@dataclass(frozen=True)
class CommentEvent:
    comment: CommentDTO
    action: CommentAction
