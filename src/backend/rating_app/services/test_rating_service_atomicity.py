"""A rating mutation and its observers succeed or fail together.

Autocommit would commit the row before `notify()` runs; a listener failing
after that (aggregates, cache, the feed index) would leave the rating half
applied. `RatingService` wraps each mutation with its notifications instead.
"""

import pytest

from rating_app.application_schemas.rating import RatingPatchParams
from rating_app.ioc_container.repositories import rating_repository
from rating_app.ioc_container.services import rating_service
from rating_app.models import Rating

pytestmark = [pytest.mark.django_db, pytest.mark.integration]


class ListenerError(RuntimeError):
    pass


class FailingListener:
    def on_event(self, event, *args, **kwargs) -> None:
        raise ListenerError


@pytest.fixture
def service(monkeypatch):
    svc = rating_service()
    # Appended, so it runs after the real observers, like the feed observer does.
    monkeypatch.setattr(svc, "_listeners", [*svc._listeners, FailingListener()])
    return svc


def test_delete_is_rolled_back_when_a_listener_fails(service, rating_factory):
    rating = rating_factory(comment="Лишається")
    dto = rating_repository().get_by_id(str(rating.id))

    with pytest.raises(ListenerError):
        service.delete_rating(dto)

    assert Rating.objects.filter(pk=rating.pk).exists()


def test_update_is_rolled_back_when_a_listener_fails(service, rating_factory):
    rating = rating_factory(comment="До")
    dto = rating_repository().get_by_id(str(rating.id))

    with pytest.raises(ListenerError):
        service.update_rating(dto, RatingPatchParams(comment="Після"))

    rating.refresh_from_db()
    assert rating.comment == "До"
