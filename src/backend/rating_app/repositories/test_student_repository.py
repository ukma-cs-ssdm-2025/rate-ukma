from unittest.mock import patch

import pytest

from rating_app.application_schemas.student import Student as StudentDTO
from rating_app.application_schemas.student import StudentInput
from rating_app.models import Student
from rating_app.models.choices import EducationLevel
from rating_app.repositories.student_repository import StudentRepository
from rating_app.repositories.to_domain_mappers import StudentMapper


@pytest.fixture
def repo():
    return StudentRepository(mapper=StudentMapper())


@pytest.mark.django_db
@pytest.mark.integration
def test_get_by_email_picks_newest_unlinked_student_when_email_is_reused(
    repo, student_factory, user_factory
):
    email = "oshevchenko@ukma.edu.ua"
    student_factory(email=email, program_start_academic_year_start=None)
    student_factory(email=email, program_start_academic_year_start=2019)
    newest = student_factory(email=email, program_start_academic_year_start=2026)
    student_factory(email=email, program_start_academic_year_start=2027, user=user_factory())

    with patch("rating_app.repositories.student_repository.logger") as mock_logger:
        result = repo.get_by_email(email)

    assert result is not None
    assert result.id == newest.id
    mock_logger.warning.assert_called_once_with(
        "multiple_students_with_same_email", email=email, chosen_student_id=str(newest.id)
    )


@pytest.mark.django_db
@pytest.mark.integration
def test_get_by_email_returns_none_when_no_unlinked_student(repo):
    assert repo.get_by_email("nobody@ukma.edu.ua") is None


@pytest.mark.django_db
@pytest.mark.integration
def test_get_all_prefetches_related_speciality(repo, django_assert_num_queries, student_factory):
    student_factory.create_batch(3)

    result = repo.get_all()

    assert len(result) == 3
    assert all(isinstance(s, StudentDTO) for s in result)
    # speciality_name is mapped from the prefetched speciality
    assert all(s.speciality_name is not None for s in result)


@pytest.mark.django_db
@pytest.mark.integration
def test_get_or_create_updates_email_when_student_exists_without_email(
    repo, speciality_factory, student_factory
):
    speciality = speciality_factory()
    existing = student_factory(
        first_name="John",
        last_name="Doe",
        patronymic="Smith",
        education_level=EducationLevel.BACHELOR,
        speciality=speciality,
        email="",
    )

    student_dto = StudentDTO(
        id=existing.id,
        first_name="John",
        last_name="Doe",
        patronymic="Smith",
        education_level=EducationLevel.BACHELOR,
        speciality_id=speciality.id,
        email="john.doe@ukma.edu.ua",
    )

    student, created = repo.get_or_create(student_dto)

    assert created is False
    assert student.id == existing.id
    refreshed = Student.objects.get(id=student.id)
    assert refreshed.email == "john.doe@ukma.edu.ua"


@pytest.mark.django_db
@pytest.mark.integration
def test_get_or_create_does_not_update_email_when_student_has_email(
    repo, speciality_factory, student_factory
):
    speciality = speciality_factory()
    existing = student_factory(
        first_name="John",
        last_name="Doe",
        patronymic="Smith",
        education_level=EducationLevel.BACHELOR,
        speciality=speciality,
        email="existing@ukma.edu.ua",
    )

    student_dto = StudentDTO(
        id=existing.id,
        first_name="John",
        last_name="Doe",
        patronymic="Smith",
        education_level=EducationLevel.BACHELOR,
        speciality_id=speciality.id,
        email="new@ukma.edu.ua",
    )

    student, created = repo.get_or_create(student_dto)

    assert created is False
    refreshed = Student.objects.get(id=student.id)
    assert refreshed.email == "existing@ukma.edu.ua"


@pytest.mark.django_db
@pytest.mark.integration
def test_student_mapper_normalizes_empty_education_level_to_none(student_factory):
    student = student_factory(education_level="")
    mapper = StudentMapper()
    result = mapper.process(student)
    assert result.education_level is None


@pytest.mark.django_db
@pytest.mark.integration
def test_get_or_upsert_prefers_email_match_and_updates_student_fields(
    repo, speciality_factory, student_factory
):
    original_speciality = speciality_factory(name="Original Speciality")
    updated_speciality = speciality_factory(name="Updated Speciality")
    existing = student_factory(
        first_name="John",
        last_name="Doe",
        patronymic="Smith",
        education_level=EducationLevel.BACHELOR,
        speciality=original_speciality,
        email="jdoe@ukma.edu.ua",
        program_start_academic_year_start=2022,
    )

    student_dto = StudentDTO(
        id=existing.id,
        first_name=" john ",
        last_name="Dough",
        patronymic="Smith",
        education_level=EducationLevel.MASTER,
        speciality_id=updated_speciality.id,
        email="jdoe@ukma.edu.ua",
        program_start_academic_year_start=2023,
    )

    student, created = repo.get_or_upsert(student_dto)

    assert created is False
    assert Student.objects.filter(email="jdoe@ukma.edu.ua").count() == 1
    refreshed = Student.objects.get(id=student.id)
    assert refreshed.last_name == "Dough"
    assert refreshed.education_level == EducationLevel.MASTER
    assert refreshed.speciality_id == updated_speciality.id
    assert refreshed.program_start_academic_year_start == 2022


@pytest.mark.django_db
@pytest.mark.integration
def test_get_or_upsert_creates_new_student_when_reused_email_has_other_first_name(
    repo, speciality_factory, student_factory
):
    speciality = speciality_factory()
    earlier = student_factory(
        first_name="Andrii",
        last_name="Example",
        education_level=EducationLevel.MASTER,
        speciality=speciality,
        email="aexample@ukma.edu.ua",
        program_start_academic_year_start=2023,
    )

    student_input = StudentInput(
        first_name="Alina",
        last_name="Example",
        patronymic="",
        education_level=EducationLevel.BACHELOR,
        speciality_id=speciality.id,
        email="aexample@ukma.edu.ua",
        program_start_academic_year_start=2026,
    )

    student, created = repo.get_or_upsert(student_input)

    assert created is True
    assert student.id != earlier.id
    assert Student.objects.filter(email="aexample@ukma.edu.ua").count() == 2
    earlier.refresh_from_db()
    assert earlier.first_name == "Andrii"
    assert earlier.program_start_academic_year_start == 2023


@pytest.mark.django_db
@pytest.mark.integration
def test_get_or_upsert_keeps_earliest_program_start_year(repo, speciality_factory, student_factory):
    speciality = speciality_factory()
    existing = student_factory(
        first_name="Iryna",
        last_name="Example",
        patronymic="Studentivna",
        education_level=EducationLevel.BACHELOR,
        speciality=speciality,
        email="iryna.example@ukma.edu.ua",
        program_start_academic_year_start=2021,
    )

    student_dto = StudentDTO(
        id=existing.id,
        first_name="Iryna",
        last_name="Example",
        patronymic="Studentivna",
        education_level=EducationLevel.BACHELOR,
        speciality_id=speciality.id,
        email="iryna.example@ukma.edu.ua",
        program_start_academic_year_start=2023,
    )

    repo.get_or_upsert(student_dto)

    refreshed = Student.objects.get(id=existing.id)
    assert refreshed.program_start_academic_year_start == 2021
