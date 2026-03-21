from unittest.mock import patch

import pytest

from rating_app.application_schemas.student import Student as StudentDTO
from rating_app.models import Student
from rating_app.models.choices import EducationLevel
from rating_app.repositories.student_repository import StudentRepository
from rating_app.repositories.to_domain_mappers import StudentMapper
from rating_app.tests.factories import SpecialityFactory, StudentFactory


@pytest.fixture
def repo():
    return StudentRepository(mapper=StudentMapper())


@pytest.mark.django_db
@pytest.mark.integration
def test_get_by_email_returns_none_and_logs_warning_when_multiple_students_found(repo):
    with (
        patch(
            "rating_app.repositories.student_repository.StudentRepository._build_base_queryset"
        ) as mock_qs,
        patch("rating_app.repositories.student_repository.logger") as mock_logger,
    ):
        mock_qs.return_value.get.side_effect = Student.MultipleObjectsReturned
        result = repo.get_by_email("duplicate@ukma.edu.ua")

    assert result is None
    mock_logger.warning.assert_called_once_with(
        "multiple_students_with_same_email", email="duplicate@ukma.edu.ua"
    )


@pytest.mark.django_db
@pytest.mark.integration
def test_get_all_prefetches_related_speciality(repo, django_assert_num_queries):
    StudentFactory.create_batch(3)

    result = repo.get_all()

    assert len(result) == 3
    assert all(isinstance(s, StudentDTO) for s in result)
    # speciality_name is mapped from the prefetched speciality
    assert all(s.speciality_name is not None for s in result)


@pytest.mark.django_db
@pytest.mark.integration
def test_get_or_create_updates_email_when_student_exists_without_email(repo):
    speciality = SpecialityFactory()
    existing = StudentFactory(
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
def test_get_or_create_does_not_update_email_when_student_has_email(repo):
    speciality = SpecialityFactory()
    existing = StudentFactory(
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
def test_student_mapper_normalizes_empty_education_level_to_none():
    student = StudentFactory(education_level="")
    mapper = StudentMapper()
    result = mapper.process(student)
    assert result.education_level is None


@pytest.mark.django_db
@pytest.mark.integration
def test_get_or_upsert_prefers_email_match_and_updates_student_fields(repo):
    original_speciality = SpecialityFactory(name="Original Speciality")
    updated_speciality = SpecialityFactory(name="Updated Speciality")
    existing = StudentFactory(
        first_name="John",
        last_name="Doe",
        patronymic="Smith",
        education_level=EducationLevel.BACHELOR,
        speciality=original_speciality,
        email="john.doe@ukma.edu.ua",
        program_start_academic_year_start=2022,
    )

    student_dto = StudentDTO(
        id=existing.id,
        first_name="Johnny",
        last_name="Doe",
        patronymic="Smith",
        education_level=EducationLevel.MASTER,
        speciality_id=updated_speciality.id,
        email="john.doe@ukma.edu.ua",
        program_start_academic_year_start=2023,
    )

    student, created = repo.get_or_upsert(student_dto)

    assert created is False
    refreshed = Student.objects.get(id=student.id)
    assert refreshed.first_name == "Johnny"
    assert refreshed.education_level == EducationLevel.MASTER
    assert refreshed.speciality_id == updated_speciality.id
    assert refreshed.program_start_academic_year_start == 2022


@pytest.mark.django_db
@pytest.mark.integration
def test_get_or_upsert_keeps_earliest_program_start_year(repo):
    speciality = SpecialityFactory()
    existing = StudentFactory(
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
