from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

import pytest
from faker import Faker

from rating_app.tests.factories import (
    CourseFactory,
    CourseInstructorFactory,
    CourseOfferingFactory,
    CourseSpecialityFactory,
    DepartmentFactory,
    EnrollmentFactory,
    FacultyFactory,
    InstructorFactory,
    RatingFactory,
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
def course_speciality_factory():
    return CourseSpecialityFactory


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
def speciality_factory():
    return SpecialityFactory


@pytest.fixture
def faculty_factory():
    return FacultyFactory


@pytest.fixture
def department_factory():
    return DepartmentFactory


# Cache mocking fixtures
class FakeCacheManager:
    def __init__(self):
        self.store = {}

    def get(self, key):
        return self.store.get(key)

    def set(self, key, value, ttl=None):
        self.store[key] = value

    def invalidate_pattern(self, pattern):
        keys_to_remove = [k for k in self.store.keys() if pattern.replace("*", "") in k]
        for key in keys_to_remove:
            del self.store[key]
        return len(keys_to_remove)


@pytest.fixture(autouse=True)
def fake_cache(monkeypatch):
    fake = FakeCacheManager()

    monkeypatch.setattr("rateukma.caching.decorators.redis_cache_manager", lambda: fake)
    monkeypatch.setattr("rateukma.caching.instances.redis_cache_manager", lambda: fake)

    yield fake
