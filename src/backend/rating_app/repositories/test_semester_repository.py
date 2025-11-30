import pytest

from rating_app.repositories import SemesterRepository


@pytest.fixture
def repo():
    return SemesterRepository()
