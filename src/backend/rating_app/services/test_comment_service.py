import uuid
from datetime import UTC, datetime
from unittest.mock import MagicMock

import pytest

from rating_app.application_schemas.comment import (
    CommentCreateParams,
    CommentDTO,
    CommentPatchParams,
)
from rating_app.services.comment_events import CommentAction, CommentEvent
from rating_app.services.comment_service import CommentService


@pytest.fixture
def comment_repository():
    return MagicMock()


@pytest.fixture
def comment_normalizer():
    return MagicMock()


@pytest.fixture
def service(comment_repository, comment_normalizer):
    return CommentService(
        comment_repository=comment_repository,
        comment_normalizer=comment_normalizer,
    )


def _make_comment_dto() -> CommentDTO:
    return CommentDTO(
        id=uuid.uuid4(),
        user_id=1,
        user_name="Test User",
        user_avatar_url=None,
        rating_id=uuid.uuid4(),
        parent_id=None,
        content="Helpful comment",
        is_anonymous=False,
        created_at=datetime.now(tz=UTC),
        replies_count=0,
    )


def test_create_comment_notifies_created_action(
    service,
    comment_repository,
    comment_normalizer,
):
    listener = MagicMock()
    service.add_observer(listener)
    params = CommentCreateParams(
        rating=uuid.uuid4(),
        user=1,
        parent_comment=None,
        content=" Helpful comment ",
        is_anonymous=False,
    )
    comment = _make_comment_dto()
    comment_normalizer.normalize_comment.return_value = "Helpful comment"
    comment_repository.create.return_value = comment

    result = service.create_comment(params)

    assert result == comment
    assert params.content == "Helpful comment"
    listener.on_event.assert_called_once_with(
        CommentEvent(comment=comment, action=CommentAction.CREATED)
    )


def test_delete_comment_notifies_deleted_action(service, comment_repository):
    listener = MagicMock()
    service.add_observer(listener)
    comment = _make_comment_dto()

    service.delete_comment(comment)

    listener.on_event.assert_called_once_with(
        CommentEvent(comment=comment, action=CommentAction.DELETED)
    )
    comment_repository.delete.assert_called_once_with(str(comment.id))


def test_update_comment_notifies_updated_action(
    service,
    comment_repository,
    comment_normalizer,
):
    listener = MagicMock()
    service.add_observer(listener)
    comment = _make_comment_dto()
    updated_comment = comment.model_copy(update={"content": "Updated content"})
    update_data = CommentPatchParams(content=" Updated content ")
    comment_normalizer.normalize_comment.return_value = "Updated content"
    comment_repository.update.return_value = updated_comment

    result = service.update_comment(comment, update_data)

    assert result == updated_comment
    assert update_data.content == "Updated content"
    listener.on_event.assert_called_once_with(
        CommentEvent(comment=comment, action=CommentAction.UPDATED)
    )
