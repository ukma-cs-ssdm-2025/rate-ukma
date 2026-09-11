from importlib import import_module

from django.apps import apps
from django.contrib.auth import get_user_model
from django.db import connection
from django.db.migrations import RunPython
from rest_framework.test import APIClient

import pytest
from faker import Faker

from rateukma.caching.cache_manager import InMemoryCacheManager
from rating_app.tests.factories import (
    CommentFactory,
    CourseFactory,
    CourseInstructorFactory,
    CourseOfferingFactory,
    CourseOfferingSpecialityFactory,
    EnrollmentFactory,
    FeedPostFactory,
    InstructorFactory,
    RatingFactory,
    RatingVoteFactory,
    SemesterFactory,
    SpecialityFactory,
    StudentFactory,
)


class AuthClient:
    def __init__(self, client: APIClient, user):
        self._client = client
        self.user = user

    def __getattr__(self, name):
        return getattr(self._client, name)

    def __iter__(self):
        yield self._client
        yield self.user


# core fixtures


@pytest.fixture
def user(db, user_factory):
    return user_factory(email="student@ukma.edu.ua")


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


@pytest.fixture
def user_factory(db):
    User = get_user_model()  # noqa: N806
    faker = Faker()

    def _create_user(*, email: str | None = None, password: str | None = None, **extra):
        email = email or faker.email(domain="ukma.edu.ua")
        password_value = password or faker.password(length=12)
        username = extra.pop("username", email)
        return User.objects.create_user(
            username=username,
            email=email,
            password=password_value,
            **extra,
        )

    return _create_user


@pytest.fixture
def invalid_user_factory(db):
    User = get_user_model()  # noqa: N806
    faker = Faker()

    def _create_invalid_user(*, password: str | None = None, **extra):
        email = faker.email()  # non-ukma domain for negative scenarios
        password_value = password or faker.password(length=12)
        username = extra.pop("username", email)
        return User.objects.create_user(
            username=username,
            email=email,
            password=password_value,
            **extra,
        )

    return _create_invalid_user


@pytest.fixture
def course_factory():
    return CourseFactory


@pytest.fixture
def course_offering_factory():
    return CourseOfferingFactory


@pytest.fixture
def course_offering_speciality_factory():
    return CourseOfferingSpecialityFactory


@pytest.fixture
def speciality_factory():
    return SpecialityFactory


@pytest.fixture
def instructor_factory():
    return InstructorFactory


@pytest.fixture
def course_instructor_factory():
    return CourseInstructorFactory


@pytest.fixture
def rating_factory():
    return RatingFactory


@pytest.fixture
def student_factory():
    return StudentFactory


@pytest.fixture
def enrollment_factory():
    return EnrollmentFactory


@pytest.fixture
def semester_factory():
    return SemesterFactory


@pytest.fixture
def vote_factory():
    return RatingVoteFactory


@pytest.fixture
def comment_factory():
    return CommentFactory


@pytest.fixture
def feed_post_factory():
    return FeedPostFactory


@pytest.fixture
def run_data_migration(db):
    """Drive one migration's `RunPython` steps against the test database.

    The test schema is built straight from the models (`MIGRATION_MODULES` is
    off in `settings.testing`), so data migrations never run in CI on their own.
    The live app registry stands in for the historical one, which holds as long
    as the migration only touches models that still exist in their current shape.
    """

    def _run(name: str, *, backwards: bool = False) -> None:
        module = import_module(f"rating_app.migrations.{name}")
        # Never entered: on SQLite that would try to drop constraint checks inside
        # the test transaction. The callables here do not use it anyway.
        schema_editor = connection.schema_editor(atomic=False)

        steps = [op for op in module.Migration.operations if isinstance(op, RunPython)]
        if backwards:
            steps.reverse()

        for step in steps:
            code = step.reverse_code if backwards else step.code
            code(apps, schema_editor)

    return _run


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
