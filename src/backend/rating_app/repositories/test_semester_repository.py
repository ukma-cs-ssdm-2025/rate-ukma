from datetime import datetime

import pytest

from rating_app.models.choices import SemesterTerm
from rating_app.repositories import SemesterRepository
from rating_app.tests.factories import (
    SemesterFactory,
)


@pytest.fixture
def repo():
    return SemesterRepository()


@pytest.mark.django_db
def test_get_current_semester(repo):
    month = datetime.now().month
    if month >= 9:
        term = SemesterTerm.FALL
    elif month >= 1 and month < 5:
        term = SemesterTerm.SPRING
    else:
        term = SemesterTerm.SUMMER

    SemesterFactory(year=datetime.now().year, term=term)
    result = repo.get_current()

    assert result.year == datetime.now().year
    assert result.term == term
