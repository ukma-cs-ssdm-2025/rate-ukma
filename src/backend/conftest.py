from rest_framework.test import APIClient

import pytest
from pytest_factoryboy import register

from rateukma.caching.cache_manager import InMemoryCacheManager
from rating_app.tests import factories

# Each register() generates `<model>` and `<model>_factory` fixtures.
register(factories.UserFactory)
register(factories.FacultyFactory)
register(factories.DepartmentFactory)
register(factories.SpecialityFactory)
register(factories.CourseFactory)
register(factories.SemesterFactory)
register(factories.InstructorFactory)
register(factories.CourseOfferingFactory)
register(factories.CourseInstructorFactory)
register(factories.CourseOfferingTermFactory)
register(factories.CourseOfferingSpecialityFactory)
register(factories.StudentFactory)
register(factories.EnrollmentFactory)
register(factories.RatingFactory)
register(factories.RatingVoteFactory)
register(factories.CommentFactory)
register(factories.FeedPostFactory)
register(factories.PromoBannerFactory)


@pytest.fixture
def user__email():
    """Default email for the registered `user` fixture: the suite assumes the
    internal UKMA domain, since that is what the OAuth adapter accepts."""
    return "student@ukma.edu.ua"


class AuthClient:
    def __init__(self, client: APIClient, user):
        self._client = client
        self.user = user

    def __getattr__(self, name):
        return getattr(self._client, name)

    def __iter__(self):
        yield self._client
        yield self.user


@pytest.fixture
def api_client():
    """Unauthenticated DRF client."""
    return APIClient()


@pytest.fixture
def token_client(api_client, user):
    """
    Authenticated DRF client, backward-compatible:
      - supports token_client.get(...), post(...), etc. (acts like APIClient)
      - supports unpacking: client, user = token_client
      - exposes .user attribute
    """
    api_client.force_authenticate(user=user)
    return AuthClient(api_client, user)


@pytest.fixture(autouse=True)
def mock_cache_manager(monkeypatch):
    cache = InMemoryCacheManager()

    monkeypatch.setattr("rateukma.caching.decorators.redis_cache_manager", lambda: cache)
    monkeypatch.setattr("rateukma.caching.instances.redis_cache_manager", lambda: cache)
    monkeypatch.setattr("rating_app.ioc_container.services.redis_cache_manager", lambda: cache)
    monkeypatch.setattr("rating_app.signals.redis_cache_manager", lambda: cache)

    # The @once singletons holding a cache manager are created at app startup
    # (apps.ready → register_observers) and hold a reference to the startup
    # cache instance. Patch their .cache_manager so they use the per-test cache,
    # keeping version bumps and @rcached reads on the same instance.
    from rating_app.ioc_container.services import (
        comment_cache_invalidator,
        feed_service,
        rating_cache_invalidator,
        rating_vote_cache_invalidator,
    )

    monkeypatch.setattr(feed_service(), "cache_manager", cache)
    monkeypatch.setattr(comment_cache_invalidator(), "cache_manager", cache)
    monkeypatch.setattr(rating_cache_invalidator(), "cache_manager", cache)
    monkeypatch.setattr(rating_vote_cache_invalidator(), "cache_manager", cache)

    yield cache

    cache.clear()
