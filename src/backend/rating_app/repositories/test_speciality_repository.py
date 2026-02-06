import pytest

from rating_app.application_schemas.speciality import Speciality as SpecialityDTO
from rating_app.repositories.speciality_repository import SpecialityRepository
from rating_app.repositories.to_domain_mappers import SpecialityMapper
from rating_app.tests.factories import SpecialityFactory


@pytest.fixture
def repo():
    return SpecialityRepository(mapper=SpecialityMapper())


@pytest.mark.django_db
@pytest.mark.integration
def test_get_all_prefetches_related_faculty(repo, django_assert_num_queries):
    SpecialityFactory.create_batch(3)

    result = repo.get_all()

    assert len(result) == 3
    assert all(isinstance(s, SpecialityDTO) for s in result)
    # faculty_name is mapped from the prefetched faculty
    assert all(s.faculty_name is not None for s in result)


@pytest.mark.django_db
@pytest.mark.integration
def test_get_by_name_prefetches_related_faculty(repo, django_assert_num_queries):
    speciality = SpecialityFactory(name="Computer Science")

    result = repo.get_by_name("Computer Science")

    assert result is not None
    assert result.id == speciality.id
    assert result.faculty_name is not None
