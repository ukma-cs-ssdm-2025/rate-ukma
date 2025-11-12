from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

import pytest

from rating_app.tests.factories import (
    CourseFactory,
    CourseInstructorFactory,
    CourseOfferingFactory,
    CourseSpecialityFactory,
    EnrollmentFactory,
    InstructorFactory,
    RatingFactory,
    SemesterFactory,
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
def user(db):
    user = get_user_model()
    return user.objects.create_user(
        username="student",
        email="student@ukma.edu.ua",
        password="pass123",
    )


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
