import uuid

import pytest

from rating_app.application_schemas.semester import Semester as SemesterDTO
from rating_app.models.choices import SemesterTerm
from rating_app.repositories.semester_repository import SemesterRepository
from rating_app.repositories.to_domain_mappers import SemesterMapper
from rating_app.tests.factories import SemesterFactory


@pytest.fixture
def repo():
    return SemesterRepository(mapper=SemesterMapper())


@pytest.mark.django_db
@pytest.mark.integration
def test_get_or_create_creates_different_semester_with_same_year_different_term(repo):
    existing = SemesterFactory(year=2024, term=SemesterTerm.FALL)

    semester_dto = SemesterDTO(
        id=uuid.uuid4(),
        year=existing.year,
        term=SemesterTerm.SPRING,
    )

    semester, created = repo.get_or_create(semester_dto)

    assert created is True
    assert semester.id != existing.id
    assert semester.year == existing.year
    assert semester.term == SemesterTerm.SPRING


@pytest.mark.django_db
@pytest.mark.integration
def test_get_or_create_creates_different_semester_with_same_term_different_year(repo):
    existing = SemesterFactory(year=2024, term=SemesterTerm.FALL)

    semester_dto = SemesterDTO(
        id=uuid.uuid4(),
        year=2023,
        term=SemesterTerm.FALL,
    )

    semester, created = repo.get_or_create(semester_dto)

    assert created is True
    assert semester.id != existing.id
    assert semester.term == existing.term
    assert semester.year == 2023
