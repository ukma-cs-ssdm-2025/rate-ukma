import pytest

from rating_app.repositories.speciality_repository import SpecialityRepository
from rating_app.tests.factories import SpecialityFactory


@pytest.fixture
def repo():
    return SpecialityRepository()


@pytest.mark.django_db
@pytest.mark.integration
def test_get_all_prefetches_related_faculty(repo, django_assert_num_queries):
    SpecialityFactory.create_batch(3)

    result = repo.get_all()

    with django_assert_num_queries(0):
        for speciality in result:
            _ = speciality.faculty.name


@pytest.mark.django_db
@pytest.mark.integration
def test_get_by_name_prefetches_related_faculty(repo, django_assert_num_queries):
    speciality = SpecialityFactory(name="Computer Science")

    result = repo.get_by_name("Computer Science")

    assert result.id == speciality.id
    with django_assert_num_queries(0):
        _ = result.faculty.name
