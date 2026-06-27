from uuid import uuid4

import pytest

from rating_app.application_schemas.instructor import Instructor as InstructorDTO
from rating_app.exception.instructor_exceptions import InstructorNotFoundError
from rating_app.ioc_container.repositories import instructor_mapper
from rating_app.repositories.instructor_repository import InstructorRepository
from rating_app.tests.factories import (
    CourseFactory,
    CourseOfferingFactory,
    InstructorFactory,
    RatingFactory,
)


@pytest.fixture
def repo():
    return InstructorRepository(instructor_mapper())


@pytest.mark.django_db
@pytest.mark.integration
def test_get_by_id_raises_custom_exception_when_not_found(repo):
    invalid_id = "00000000-0000-0000-0000-000000000000"

    with pytest.raises(InstructorNotFoundError):
        repo.get_by_id(invalid_id)


@pytest.mark.django_db
@pytest.mark.integration
def test_get_or_create_handles_empty_patronymic(repo):
    data = InstructorDTO(
        id=uuid4(),
        first_name="Jane",
        last_name="Smith",
        patronymic="",
        email="jane.smith@ukma.edu.ua",
    )

    instructor, created = repo.get_or_create(data)

    assert created is True
    assert instructor.patronymic == ""
    assert instructor.email == "jane.smith@ukma.edu.ua"


@pytest.mark.django_db
@pytest.mark.integration
def test_get_or_create_with_return_model_returns_orm_model(repo):
    data = InstructorDTO(
        id=uuid4(),
        first_name="John",
        last_name="Doe",
        patronymic="Michael",
        email="john.doe@ukma.edu.ua",
    )

    instructor, created = repo.get_or_create(data, return_model=True)

    assert created is True
    # Verify it's an ORM model (has save method)
    assert hasattr(instructor, "save")


@pytest.mark.django_db
@pytest.mark.integration
def test_get_or_create_is_idempotent_on_email(repo):
    data = InstructorDTO(
        id=uuid4(),
        first_name="Alex",
        last_name="Kovalenko",
        patronymic="",
        email="a.kovalenko@ukma.edu.ua",
    )

    first, created_first = repo.get_or_create(data)
    second, created_second = repo.get_or_create(data)

    assert created_first is True
    assert created_second is False
    assert first.id == second.id


@pytest.mark.django_db
@pytest.mark.integration
def test_list_ranked_breaks_ties_alphabetically(repo):
    # No ratings => all mention counts are zero, so ordering falls back to
    # (last_name, first_name, id).
    second = InstructorFactory.create(first_name="Bohdan", last_name="Petrenko")
    first = InstructorFactory.create(first_name="Anna", last_name="Kovalenko")
    third = InstructorFactory.create(first_name="Anna", last_name="Petrenko")

    ranked = list(repo.list_ranked())

    assert [instructor.id for instructor in ranked] == [first.id, third.id, second.id]


@pytest.mark.django_db
@pytest.mark.integration
def test_get_many_by_ids_with_empty_list_returns_empty(repo):
    assert repo.get_many_by_ids([]) == []


@pytest.mark.django_db
@pytest.mark.integration
def test_get_many_by_ids_returns_only_matching_and_omits_unknown(repo):
    existing = InstructorFactory.create()
    other = InstructorFactory.create()

    result = repo.get_many_by_ids([existing.id, uuid4()])

    assert [instructor.id for instructor in result] == [existing.id]
    assert other.id not in {instructor.id for instructor in result}


@pytest.mark.django_db
@pytest.mark.integration
def test_list_ranked_orders_cyrillic_before_latin_at_equal_mentions(repo):
    # No ratings => equal (zero) mentions, so script ordering decides:
    # Cyrillic names come before Latin ones, each group alphabetical.
    latin_a = InstructorFactory.create(first_name="Anna", last_name="Adams")
    cyrillic_ya = InstructorFactory.create(first_name="Юрій", last_name="Яременко")
    cyrillic_a = InstructorFactory.create(first_name="Андрій", last_name="Андрієнко")
    latin_z = InstructorFactory.create(first_name="Zach", last_name="Zorin")

    ranked = list(repo.list_ranked())

    assert [i.id for i in ranked] == [
        cyrillic_a.id,
        cyrillic_ya.id,
        latin_a.id,
        latin_z.id,
    ]


@pytest.mark.django_db
@pytest.mark.integration
def test_list_ranked_tiers_offering_then_course_then_global(repo):
    # Same course, two offerings (semesters).
    course = CourseFactory.create()
    offering_a = CourseOfferingFactory.create(course=course)
    offering_b = CourseOfferingFactory.create(course=course)
    other_offering = CourseOfferingFactory.create()  # unrelated course

    on_offering = InstructorFactory.create(last_name="Aaa")  # exact offering
    on_course = InstructorFactory.create(last_name="Bbb")  # same course, other offering
    rated_elsewhere = InstructorFactory.create(last_name="Ccc")  # only global mention
    never_rated = InstructorFactory.create(last_name="Ddd")  # directory tail

    RatingFactory.create(course_offering=offering_a).instructors.add(on_offering)
    RatingFactory.create(course_offering=offering_b).instructors.add(on_course)
    RatingFactory.create(course_offering=other_offering).instructors.add(rated_elsewhere)

    ranked = list(
        repo.list_ranked(course_offering_id=offering_a.id, course_id=course.id)
    )

    assert [i.id for i in ranked] == [
        on_offering.id,
        on_course.id,
        rated_elsewhere.id,
        never_rated.id,
    ]
