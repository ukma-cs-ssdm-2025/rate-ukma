from datetime import timedelta

from django.utils import timezone

import pytest

from rating_app.models import Comment


@pytest.mark.django_db
@pytest.mark.integration
def test_comments_list_returns_top_level_comments_only(
    token_client,
    rating_factory,
    comment_factory,
):
    rating = rating_factory()
    top_level = comment_factory.create_batch(3, rating=rating)
    comment_factory(rating=rating, parent_comment=top_level[0])

    response = token_client.get(f"/api/v1/ratings/{rating.id}/comments/")
    data = response.json()

    assert response.status_code == 200
    assert data["total"] == 3
    assert len(data["items"]) == 3
    assert {item["id"] for item in data["items"]} == {str(comment.id) for comment in top_level}
    assert all(item["parent_id"] is None for item in data["items"])


@pytest.mark.django_db
@pytest.mark.integration
def test_comments_list_includes_replies_count(token_client, rating_factory, comment_factory):
    rating = rating_factory()
    parent = comment_factory(rating=rating)
    comment_factory.create_batch(2, rating=rating, parent_comment=parent)

    response = token_client.get(f"/api/v1/ratings/{rating.id}/comments/")
    data = response.json()

    assert response.status_code == 200
    assert data["items"][0]["id"] == str(parent.id)
    assert data["items"][0]["replies_count"] == 2


@pytest.mark.django_db
@pytest.mark.integration
def test_comments_list_includes_reply_author_avatars(
    token_client,
    rating_factory,
    comment_factory,
    user_factory,
):
    rating = rating_factory()
    parent = comment_factory(rating=rating)
    first_reply_user = user_factory(first_name="Reply", last_name="Author")
    second_reply_user = user_factory(first_name="Second", last_name="Author")

    created_at = timezone.now()
    first_reply = comment_factory(
        rating=rating,
        parent_comment=parent,
        user=first_reply_user,
    )
    second_reply = comment_factory(
        rating=rating,
        parent_comment=parent,
        user=second_reply_user,
    )
    Comment.objects.filter(pk=first_reply.pk).update(created_at=created_at)
    Comment.objects.filter(pk=second_reply.pk).update(created_at=created_at + timedelta(seconds=1))

    response = token_client.get(f"/api/v1/ratings/{rating.id}/comments/")
    data = response.json()

    assert response.status_code == 200
    reply_authors = data["items"][0]["reply_authors"]
    assert reply_authors == [
        {
            "user_id": first_reply_user.id,
            "user_name": "Author Reply",
            "user_avatar_url": None,
            "is_anonymous": False,
        },
        {
            "user_id": second_reply_user.id,
            "user_name": "Author Second",
            "user_avatar_url": None,
            "is_anonymous": False,
        },
    ]


@pytest.mark.django_db
@pytest.mark.integration
def test_comment_replies_list(token_client, rating_factory, comment_factory):
    rating = rating_factory()
    parent = comment_factory(rating=rating)
    replies = comment_factory.create_batch(2, rating=rating, parent_comment=parent)
    comment_factory(rating=rating)

    response = token_client.get(f"/api/v1/comments/{parent.id}/replies/")
    data = response.json()

    assert response.status_code == 200
    assert data["total"] == 2
    assert {item["id"] for item in data["items"]} == {str(reply.id) for reply in replies}
    assert all(item["parent_id"] == str(parent.id) for item in data["items"])


@pytest.mark.django_db
@pytest.mark.integration
def test_comments_list_response_is_cached_between_calls(
    token_client,
    rating_factory,
    comment_factory,
):
    rating = rating_factory()
    comment = comment_factory(rating=rating)

    response = token_client.get(f"/api/v1/ratings/{rating.id}/comments/")
    assert response.status_code == 200
    assert response.json()["items"][0]["id"] == str(comment.id)

    Comment.objects.filter(id=comment.id).delete()

    response = token_client.get(f"/api/v1/ratings/{rating.id}/comments/")
    assert response.status_code == 200
    assert response.json()["items"][0]["id"] == str(comment.id)


@pytest.mark.django_db
@pytest.mark.integration
def test_comments_list_cache_invalidated_after_top_level_comment_create(
    token_client,
    rating_factory,
):
    rating = rating_factory()

    response = token_client.get(f"/api/v1/ratings/{rating.id}/comments/")
    assert response.status_code == 200
    assert response.json()["total"] == 0

    payload = {
        "content": "Fresh top-level comment",
        "parent_comment": None,
        "is_anonymous": False,
        "created_at": timezone.now().isoformat(),
    }
    response = token_client.post(f"/api/v1/ratings/{rating.id}/comments/", payload, format="json")
    assert response.status_code == 201

    response = token_client.get(f"/api/v1/ratings/{rating.id}/comments/")
    data = response.json()
    assert response.status_code == 200
    assert data["total"] == 1
    assert data["items"][0]["content"] == "Fresh top-level comment"


@pytest.mark.django_db
@pytest.mark.integration
def test_comment_create_invalidates_course_ratings_comments_count(
    token_client,
    rating_factory,
):
    rating = rating_factory()
    course = rating.course_offering.course

    response = token_client.get(f"/api/v1/courses/{course.id}/ratings/")
    assert response.status_code == 200
    assert response.json()["items"]["ratings"][0]["comments_count"] == 0

    payload = {
        "content": "Fresh top-level comment",
        "parent_comment": None,
        "is_anonymous": False,
        "created_at": timezone.now().isoformat(),
    }
    response = token_client.post(f"/api/v1/ratings/{rating.id}/comments/", payload, format="json")
    assert response.status_code == 201

    response = token_client.get(f"/api/v1/courses/{course.id}/ratings/")
    assert response.status_code == 200
    assert response.json()["items"]["ratings"][0]["comments_count"] == 1


@pytest.mark.django_db
@pytest.mark.integration
def test_comment_reply_caches_invalidated_after_reply_create(
    token_client,
    rating_factory,
    comment_factory,
):
    rating = rating_factory()
    parent = comment_factory(rating=rating)

    response = token_client.get(f"/api/v1/ratings/{rating.id}/comments/")
    assert response.status_code == 200
    assert response.json()["items"][0]["replies_count"] == 0

    response = token_client.get(f"/api/v1/comments/{parent.id}/replies/")
    assert response.status_code == 200
    assert response.json()["total"] == 0

    payload = {
        "content": "Fresh reply",
        "parent_comment": str(parent.id),
        "is_anonymous": False,
        "created_at": timezone.now().isoformat(),
    }
    response = token_client.post(f"/api/v1/ratings/{rating.id}/comments/", payload, format="json")
    assert response.status_code == 201

    response = token_client.get(f"/api/v1/ratings/{rating.id}/comments/")
    assert response.status_code == 200
    assert response.json()["items"][0]["replies_count"] == 1

    response = token_client.get(f"/api/v1/comments/{parent.id}/replies/")
    data = response.json()
    assert response.status_code == 200
    assert data["total"] == 1
    assert data["items"][0]["content"] == "Fresh reply"


@pytest.mark.django_db
@pytest.mark.integration
def test_comments_list_cache_invalidated_after_comment_update(
    token_client,
    rating_factory,
    comment_factory,
):
    rating = rating_factory()
    comment = comment_factory(rating=rating, user=token_client.user, content="Old content")

    response = token_client.get(f"/api/v1/ratings/{rating.id}/comments/")
    assert response.status_code == 200
    assert response.json()["items"][0]["content"] == "Old content"

    response = token_client.patch(
        f"/api/v1/comments/{comment.id}/",
        {"content": "Updated content"},
        format="json",
    )
    assert response.status_code == 200

    response = token_client.get(f"/api/v1/ratings/{rating.id}/comments/")
    assert response.status_code == 200
    assert response.json()["items"][0]["content"] == "Updated content"


@pytest.mark.django_db
@pytest.mark.integration
def test_comment_reply_caches_invalidated_after_reply_delete(
    token_client,
    rating_factory,
    comment_factory,
):
    rating = rating_factory()
    parent = comment_factory(rating=rating)
    reply = comment_factory(rating=rating, parent_comment=parent, user=token_client.user)

    response = token_client.get(f"/api/v1/ratings/{rating.id}/comments/")
    assert response.status_code == 200
    assert response.json()["items"][0]["replies_count"] == 1

    response = token_client.get(f"/api/v1/comments/{parent.id}/replies/")
    assert response.status_code == 200
    assert response.json()["total"] == 1

    response = token_client.delete(f"/api/v1/comments/{reply.id}/")
    assert response.status_code == 204

    response = token_client.get(f"/api/v1/ratings/{rating.id}/comments/")
    assert response.status_code == 200
    assert response.json()["items"][0]["replies_count"] == 0

    response = token_client.get(f"/api/v1/comments/{parent.id}/replies/")
    assert response.status_code == 200
    assert response.json()["total"] == 0


@pytest.mark.django_db
@pytest.mark.integration
def test_comment_create(token_client, rating_factory):
    rating = rating_factory()
    payload = {
        "content": "This is a useful comment.",
        "parent_comment": None,
        "is_anonymous": False,
        "created_at": timezone.now().isoformat(),
    }

    response = token_client.post(f"/api/v1/ratings/{rating.id}/comments/", payload, format="json")
    data = response.json()

    assert response.status_code == 201
    assert data["content"] == payload["content"]
    assert data["rating_id"] == str(rating.id)
    assert data["parent_id"] is None
    assert data["user_id"] == token_client.user.id


@pytest.mark.django_db
@pytest.mark.integration
def test_comment_update_by_owner(token_client, rating_factory, comment_factory):
    rating = rating_factory()
    comment = comment_factory(rating=rating, user=token_client.user, content="Old content")
    payload = {
        "content": "Updated content",
        "is_anonymous": True,
    }

    response = token_client.put(f"/api/v1/comments/{comment.id}/", payload, format="json")
    data = response.json()

    assert response.status_code == 200
    assert data["content"] == "Updated content"
    assert data["is_anonymous"] is True
    assert data["user_id"] is None

    comment.refresh_from_db()
    assert comment.content == "Updated content"
    assert comment.is_anonymous is True


@pytest.mark.django_db
@pytest.mark.integration
def test_comment_patch_by_owner(token_client, rating_factory, comment_factory):
    rating = rating_factory()
    comment = comment_factory(rating=rating, user=token_client.user, is_anonymous=False)

    response = token_client.patch(
        f"/api/v1/comments/{comment.id}/",
        {"content": "Patched content"},
        format="json",
    )
    data = response.json()

    assert response.status_code == 200
    assert data["content"] == "Patched content"
    assert data["is_anonymous"] is False

    comment.refresh_from_db()
    assert comment.content == "Patched content"
    assert comment.is_anonymous is False


@pytest.mark.django_db
@pytest.mark.integration
def test_comment_update_forbidden_for_non_owner(token_client, rating_factory, comment_factory):
    comment = comment_factory(rating=rating_factory(), content="Owned by another user")

    response = token_client.patch(
        f"/api/v1/comments/{comment.id}/",
        {"content": "Should not update"},
        format="json",
    )

    assert response.status_code == 403
    comment.refresh_from_db()
    assert comment.content == "Owned by another user"


@pytest.mark.django_db
@pytest.mark.integration
def test_comment_delete_by_owner_deletes_replies(token_client, rating_factory, comment_factory):
    rating = rating_factory()
    comment = comment_factory(rating=rating, user=token_client.user)
    reply = comment_factory(rating=rating, parent_comment=comment)

    response = token_client.delete(f"/api/v1/comments/{comment.id}/")

    assert response.status_code == 204
    assert not Comment.objects.filter(id=comment.id).exists()
    assert not Comment.objects.filter(id=reply.id).exists()


@pytest.mark.django_db
@pytest.mark.integration
def test_comment_delete_forbidden_for_non_owner(token_client, rating_factory, comment_factory):
    comment = comment_factory(rating=rating_factory())

    response = token_client.delete(f"/api/v1/comments/{comment.id}/")

    assert response.status_code == 403
    assert Comment.objects.filter(id=comment.id).exists()
