import uuid

import pytest

from rating_app.application_schemas.comment import CommentCreateParams, CommentUpsertParams
from rating_app.models import Comment
from rating_app.pagination import GenericQuerysetPaginator
from rating_app.repositories.comment_repository import CommentRepository
from rating_app.repositories.to_domain_mappers import CommentMapper


@pytest.fixture
def repo():
    return CommentRepository(
        mapper=CommentMapper(),
        paginator=GenericQuerysetPaginator[Comment](),
    )


@pytest.mark.django_db
def test_create_uses_model_default_id(repo, rating_factory, user):
    params = CommentCreateParams(
        rating_id=rating_factory().id,
        user_id=user.id,
        parent_comment=None,
        content="Original comment",
        is_anonymous=False,
    )

    comment = repo.create(params)

    assert isinstance(comment.id, uuid.UUID)
    assert Comment.objects.filter(id=comment.id, content="Original comment").exists()


@pytest.mark.django_db
def test_get_or_create_creates_comment_with_explicit_upsert_id(repo, rating_factory, user):
    comment_id = uuid.uuid4()
    params = CommentUpsertParams(
        id=comment_id,
        rating_id=rating_factory().id,
        user_id=user.id,
        parent_comment=None,
        content="Original comment",
        is_anonymous=False,
    )

    comment, created = repo.get_or_create(params)

    assert created is True
    assert comment.id == comment_id
    assert Comment.objects.filter(id=comment_id, content="Original comment").exists()


@pytest.mark.django_db
def test_get_or_upsert_updates_comment_with_param_id(repo, rating_factory, user):
    comment_id = uuid.uuid4()
    params = CommentUpsertParams(
        id=comment_id,
        rating_id=rating_factory().id,
        user_id=user.id,
        parent_comment=None,
        content="Original comment",
        is_anonymous=False,
    )
    repo.get_or_create(params)

    updated, created = repo.get_or_upsert(
        params.model_copy(update={"content": "Updated comment", "is_anonymous": True})
    )

    assert created is False
    assert updated.id == comment_id
    assert updated.content == "Updated comment"
    comment = Comment.objects.get(id=comment_id)
    assert comment.content == "Updated comment"
    assert comment.is_anonymous is True
