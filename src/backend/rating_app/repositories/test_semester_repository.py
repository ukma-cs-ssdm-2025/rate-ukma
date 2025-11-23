import pytest

from rating_app.models import Semester
from rating_app.models.choices import SemesterTerm
from rating_app.repositories.semester_repository import SemesterRepository
from rating_app.tests.factories import SemesterFactory


@pytest.fixture
def repo():
    return SemesterRepository()


@pytest.mark.django_db
def test_get_all_returns_all_semesters(repo):
    # Arrange
    SemesterFactory(year=2024, term=SemesterTerm.FALL)
    SemesterFactory(year=2024, term=SemesterTerm.SPRING)
    SemesterFactory(year=2023, term=SemesterTerm.FALL)

    # Act
    result = repo.get_all()

    # Assert
    assert len(result) == 3
    assert all(isinstance(semester, Semester) for semester in result)


@pytest.mark.django_db
def test_get_all_returns_empty_list_when_no_semesters(repo):
    # Act
    result = repo.get_all()

    # Assert
    assert result == []


@pytest.mark.django_db
def test_get_by_id_returns_semester_by_id(repo):
    # Arrange
    semester = SemesterFactory()

    # Act
    result = repo.get_by_id(semester.id)

    # Assert
    assert result.id == semester.id


@pytest.mark.django_db
def test_get_by_id_raises_error_when_id_not_found(repo):
    # Arrange
    invalid_id = "00000000-0000-0000-0000-000000000000"

    # Act & Assert
    with pytest.raises(Semester.DoesNotExist):
        repo.get_by_id(invalid_id)


@pytest.mark.django_db
def test_filter_returns_all_semesters(repo):
    # Arrange
    SemesterFactory(year=2024, term=SemesterTerm.FALL)
    SemesterFactory(year=2024, term=SemesterTerm.SPRING)
    SemesterFactory(year=2023, term=SemesterTerm.FALL)

    # Act
    result = repo.filter()

    # Assert
    assert len(result) == 3


@pytest.mark.django_db
def test_get_or_create_creates_new_semester_when_not_exists(repo):
    # Arrange
    year = 2024
    term = SemesterTerm.FALL

    # Act
    semester, created = repo.get_or_create(year=year, term=term)

    # Assert
    assert created is True
    assert semester.year == year
    assert semester.term == term


@pytest.mark.django_db
def test_get_or_create_returns_existing_semester_when_exists(repo):
    # Arrange
    existing = SemesterFactory(year=2024, term=SemesterTerm.SPRING)

    # Act
    semester, created = repo.get_or_create(year=existing.year, term=existing.term)

    # Assert
    assert created is False
    assert semester.id == existing.id


@pytest.mark.django_db
def test_get_or_create_creates_different_semester_with_same_year_different_term(repo):
    # Arrange
    existing = SemesterFactory(year=2024, term=SemesterTerm.FALL)

    # Act
    semester, created = repo.get_or_create(year=2024, term=SemesterTerm.SPRING)

    # Assert
    assert created is True
    assert semester.id != existing.id
    assert semester.year == existing.year
    assert semester.term != existing.term


@pytest.mark.django_db
def test_get_or_create_creates_different_semester_with_same_term_different_year(repo):
    # Arrange
    existing = SemesterFactory(year=2024, term=SemesterTerm.FALL)

    # Act
    semester, created = repo.get_or_create(year=2023, term=SemesterTerm.FALL)

    # Assert
    assert created is True
    assert semester.id != existing.id
    assert semester.term == existing.term
    assert semester.year != existing.year


@pytest.mark.django_db
def test_create_creates_semester_with_provided_data(repo):
    # Arrange
    data = {"year": 2025, "term": SemesterTerm.SUMMER}

    # Act
    result = repo.create(**data)

    # Assert
    assert result.year == 2025
    assert result.term == SemesterTerm.SUMMER
    assert Semester.objects.filter(id=result.id).exists()


@pytest.mark.django_db
def test_update_persists_updates_to_database(repo):
    # Arrange
    semester = SemesterFactory(year=2023)
    new_year = 2024

    # Act
    repo.update(semester, year=new_year)

    # Assert
    updated = Semester.objects.get(id=semester.id)
    assert updated.year == new_year


@pytest.mark.django_db
def test_delete_deletes_semester_from_database(repo):
    # Arrange
    semester = SemesterFactory()
    semester_id = semester.id

    # Act
    repo.delete(semester)

    # Assert
    assert not Semester.objects.filter(id=semester_id).exists()


@pytest.mark.django_db
def test_delete_deletes_correct_semester(repo):
    # Arrange
    keep1 = SemesterFactory(year=2024, term=SemesterTerm.FALL)
    to_delete = SemesterFactory(year=2024, term=SemesterTerm.SPRING)
    keep2 = SemesterFactory(year=2023, term=SemesterTerm.FALL)

    # Act
    repo.delete(to_delete)

    # Assert
    remaining_ids = set(Semester.objects.values_list("id", flat=True))
    assert keep1.id in remaining_ids
    assert keep2.id in remaining_ids
    assert to_delete.id not in remaining_ids
