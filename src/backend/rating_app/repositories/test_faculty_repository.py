import pytest

from rating_app.repositories.faculty_repository import FacultyRepository
from rating_app.repositories.to_domain_mappers import FacultyMapper
from rating_app.tests.factories import FacultyFactory, SpecialityFactory


@pytest.fixture
def repo():
    return FacultyRepository(mapper=FacultyMapper())


@pytest.mark.django_db
@pytest.mark.integration
def test_get_by_speciality_name_returns_correct_faculty(repo):
    target_faculty = FacultyFactory(name="Target Faculty")
    SpecialityFactory(name="Computer Science", faculty=target_faculty)
    other_faculty = FacultyFactory()
    SpecialityFactory(name="Mathematics", faculty=other_faculty)

    result = repo.get_by_speciality_name("Computer Science")

    assert result == target_faculty


@pytest.mark.django_db
@pytest.mark.integration
def test_get_by_speciality_name_returns_none_when_speciality_not_found(repo):
    FacultyFactory(name="Arts")

    result = repo.get_by_speciality_name("Physics")

    assert result is None
