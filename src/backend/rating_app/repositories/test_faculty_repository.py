import pytest

from rating_app.repositories.faculty_repository import FacultyRepository
from rating_app.repositories.to_domain_mappers import FacultyMapper


@pytest.fixture
def repo():
    return FacultyRepository(mapper=FacultyMapper())


@pytest.mark.django_db
@pytest.mark.integration
def test_get_by_speciality_name_returns_correct_faculty(repo, faculty_factory, speciality_factory):
    target_faculty = faculty_factory(name="Target Faculty")
    speciality_factory(name="Computer Science", faculty=target_faculty)
    other_faculty = faculty_factory()
    speciality_factory(name="Mathematics", faculty=other_faculty)

    result = repo.get_by_speciality_name("Computer Science")

    assert result == target_faculty


@pytest.mark.django_db
@pytest.mark.integration
def test_get_by_speciality_name_returns_none_when_speciality_not_found(repo, faculty_factory):
    faculty_factory(name="Arts")

    result = repo.get_by_speciality_name("Physics")

    assert result is None
