from unittest.mock import MagicMock

import pytest

from rating_app.application_schemas.ukma_data import (
    UkmaDataKey,
    UkmaDataOfferingInstructor,
    UkmaDataOfferingInstructors,
    UkmaDataPage,
)
from rating_app.models import CourseInstructor, Instructor
from rating_app.models.choices import InstructorRole
from rating_app.repositories.instructor_repository import current_academic_year_start
from rating_app.services.offering_instructor_sync import OfferingInstructorSync

YEAR = current_academic_year_start()


def teacher(email: str | None, role: str = "lecturer", last_name: str = "Вигадана"):
    return UkmaDataOfferingInstructor.model_validate(
        {
            "id": f"ins_{email}",
            "lastName": last_name,
            "firstName": "Марта",
            "middleName": None,
            "email": email,
            "role": role,
        }
    )


def offering(code: str, teachers, year: int = YEAR, removed: bool = False):
    return UkmaDataOfferingInstructors.model_validate(
        {
            "sazCode": code,
            "academicYear": year,
            "instructors": [t.model_dump(by_alias=True) for t in teachers],
            "changeNo": 1,
            "removedAt": "2031-01-01T00:00:00Z" if removed else None,
        }
    )


def key(*scopes: str) -> UkmaDataKey:
    return UkmaDataKey.model_validate(
        {"id": "key_1", "scopes": list(scopes), "expiresAt": "2031-01-01T00:00:00Z"}
    )


def service_with(*pages: list[UkmaDataOfferingInstructors]) -> MagicMock:
    service = MagicMock()
    service.get_key.return_value = key("catalog:read")
    service.list_offering_instructors.side_effect = [
        UkmaDataPage[UkmaDataOfferingInstructors].model_validate(
            {
                "items": [item.model_dump(by_alias=True) for item in items],
                "cursor": n + 1,
                "hasMore": n + 1 < len(pages),
                "dataUpdatedAt": None,
            }
        )
        for n, items in enumerate(pages)
    ]
    return service


def links_of(offering_code: str) -> set[tuple[str, str]]:
    return set(
        CourseInstructor.objects.filter(course_offering__code=offering_code).values_list(
            "instructor__email", "role"
        )
    )


@pytest.mark.django_db
@pytest.mark.integration
def test_mirrors_teachers_by_code_and_email(course_offering_factory, instructor_factory):
    course_offering_factory(code="990001")
    course_offering_factory(code="990002")
    instructor_factory(email="known@example.edu")
    service = service_with(
        [
            offering("990001", [teacher("Known@Example.edu")]),
            offering("990404", [teacher("lost@example.edu")]),
        ],
        [
            offering("990002", [teacher("new@example.edu", "lecturer_and_practice_teacher")]),
            offering("990001", [teacher(None)], year=YEAR - 2),
        ],
    )

    report = OfferingInstructorSync(service).run()

    assert (report.matched, report.skipped, report.created, report.linked) == (2, 1, 1, 3)
    assert links_of("990001") == {("known@example.edu", InstructorRole.LECTURE_INSTRUCTOR)}
    assert links_of("990002") == {
        ("new@example.edu", InstructorRole.LECTURE_INSTRUCTOR),
        ("new@example.edu", InstructorRole.PRACTICUM_INSTRUCTOR),
    }
    new = Instructor.objects.get(email="new@example.edu")
    assert (new.last_name, new.first_name, new.patronymic) == ("Вигадана", "Марта", "")
    assert service.list_offering_instructors.call_args_list[1].args[0].after == 1


@pytest.mark.django_db
@pytest.mark.integration
def test_a_second_run_changes_nothing_and_unlisted_links_go(course_offering_factory):
    course_offering_factory(code="990001")
    course_offering_factory(code="990002")
    page = [
        offering("990001", [teacher("a@example.edu"), teacher("b@example.edu")]),
        offering("990002", [teacher("a@example.edu")]),
    ]
    OfferingInstructorSync(service_with(page)).run()

    again = OfferingInstructorSync(service_with(page)).run()

    assert (again.created, again.linked, again.removed) == (0, 0, 0)

    later = OfferingInstructorSync(
        service_with(
            [
                offering("990001", [teacher("b@example.edu", "practice_teacher")]),
                offering("990002", [teacher("a@example.edu")], removed=True),
            ]
        )
    ).run()

    assert (later.linked, later.removed) == (1, 3)
    assert links_of("990001") == {("b@example.edu", InstructorRole.PRACTICUM_INSTRUCTOR)}
    assert links_of("990002") == set()


def test_has_scope_reads_the_key():
    service = service_with([])

    assert OfferingInstructorSync(service).has_scope() is False

    service.get_key.return_value = key("catalog:read", "instructors:read")

    assert OfferingInstructorSync(service).has_scope() is True
