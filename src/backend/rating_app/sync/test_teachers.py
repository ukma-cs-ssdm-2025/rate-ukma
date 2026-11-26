from __future__ import annotations

from contextlib import contextmanager

import pytest

from rating_app.application_schemas import ukma_data_api as ud
from rating_app.application_schemas.ukma_data_params import UkmaDataKey
from rating_app.models import (
    CourseInstructor,
    Instructor,
    SyncApprovalOutcome,
    SyncChange,
    SyncRun,
    SyncRunStatus,
    SyncSource,
)
from rating_app.models.choices import InstructorRole
from rating_app.repositories.instructor_repository import current_academic_year_start
from rating_app.sync import apply
from rating_app.sync.apply import apply_by_policy, approve
from rating_app.sync.errors import ShortReadError, StalledReadError
from rating_app.sync.runs import start_run
from rating_app.sync.teachers import record_teacher_run, short_read_years

YEAR = current_academic_year_start()
ROLE = InstructorRole.LECTURE_INSTRUCTOR.value
PRACTICE = InstructorRole.PRACTICUM_INSTRUCTOR.value


@contextmanager
def _lock_free(_key: int):
    yield True


@pytest.fixture(autouse=True)
def lock_free(monkeypatch):
    monkeypatch.setattr(apply, "advisory_lock", _lock_free)


def teacher(email: str | None, role: str = "lecturer", last_name: str = "Вигадана"):
    return ud.OfferingInstructor.model_validate(
        {
            "id": f"ins_{email}",
            "lastName": last_name,
            "firstName": "Марта",
            "middleName": None,
            "email": email,
            "role": role,
        }
    )


def offering(code: str, teachers, *, change_no: int = 1, removed: bool = False):
    return ud.OfferingTeachers.model_validate(
        {
            "id": f"ot_{code}",
            "sazCode": code,
            "academicYear": YEAR,
            "instructors": [item.model_dump(by_alias=True) for item in teachers],
            "changeNo": change_no,
            "removedAt": "2031-01-01T00:00:00Z" if removed else None,
        }
    )


class FakeUkmaData:
    """UKMA Data serving one page per academic year."""

    def __init__(self, *, current=(), previous=(), scopes: tuple[str, ...] = ("instructors:read",)):
        self.by_year = {YEAR: list(current), YEAR - 1: list(previous)}
        self.scopes = list(scopes)

    def get_key(self) -> UkmaDataKey:
        return UkmaDataKey.model_validate(
            {"id": "key_1", "scopes": self.scopes, "expiresAt": "2031-01-01T00:00:00Z"}
        )

    def list_offering_instructors(self, params, *, year: int) -> ud.OfferingTeachersPage:
        after = params.after or 0
        rows = [row for row in self.by_year[year] if row.change_no > after]
        return ud.OfferingTeachersPage.model_validate(
            {
                "items": [row.model_dump(by_alias=True) for row in rows],
                "cursor": rows[-1].change_no if rows else after,
                "hasMore": False,
                "dataUpdatedAt": None,
            }
        )


class PagedUkmaData(FakeUkmaData):
    """UKMA Data serving one offering per page, `hasMore` until the last one."""

    def list_offering_instructors(self, params, *, year: int) -> ud.OfferingTeachersPage:
        after = params.after or 0
        rows = [row for row in self.by_year[year] if row.change_no > after]
        page = rows[:1]
        return ud.OfferingTeachersPage.model_validate(
            {
                "items": [row.model_dump(by_alias=True) for row in page],
                "cursor": page[-1].change_no if page else after,
                "hasMore": bool(page),
                "dataUpdatedAt": None,
            }
        )


class StalledUkmaData(FakeUkmaData):
    """UKMA Data that says there is more but never moves its cursor."""

    def list_offering_instructors(self, params, *, year: int) -> ud.OfferingTeachersPage:
        after = params.after or 0
        rows = [row for row in self.by_year[year] if row.change_no > after]
        return ud.OfferingTeachersPage.model_validate(
            {
                "items": [row.model_dump(by_alias=True) for row in rows],
                "cursor": after,
                "hasMore": True,
                "dataUpdatedAt": None,
            }
        )


def record(fake: FakeUkmaData) -> SyncRun:
    run = start_run(SyncSource.TEACHERS)
    return record_teacher_run(run, fake)


def links_of(code: str) -> set[tuple[str, str]]:
    return set(
        CourseInstructor.objects.filter(course_offering__code=code).values_list(
            "instructor__email", "role"
        )
    )


@pytest.mark.django_db
@pytest.mark.integration
def test_a_run_and_approving_everything_writes_what_the_old_sync_wrote(
    user, course_offering_factory, instructor_factory
):
    course_offering_factory(code="990001")
    course_offering_factory(code="990002")
    course_offering_factory(code="990003")
    instructor_factory(email="known@example.invalid")

    fake = FakeUkmaData(
        current=[
            offering("990001", [teacher("Known@Example.invalid"), teacher(None)]),
            offering("990002", [teacher("new@example.invalid", "lecturer_and_practice_teacher")]),
            offering("990404", [teacher("lost@example.invalid")]),
        ],
        previous=[offering("990003", [teacher("known@example.invalid")])],
    )

    run = record(fake)

    assert run.counts["matched"] == 3
    assert run.counts["skipped"] == 1
    assert run.counts["created"] == 1
    assert run.counts["linked"] == 4
    assert run.counts["removed"] == 0
    assert run.counts["no_email"] == 1
    assert run.cursor_from == {"after": 0}
    assert run.cursor_to == {"after": 1}
    assert CourseInstructor.objects.count() == 0
    assert Instructor.objects.count() == 1

    approval = approve([change.pk for change in run.changes.all()], user)

    assert approval.outcome == SyncApprovalOutcome.APPLIED
    assert links_of("990003") == {("known@example.invalid", ROLE)}
    assert links_of("990001") == {("known@example.invalid", ROLE)}
    assert links_of("990002") == {
        ("new@example.invalid", ROLE),
        ("new@example.invalid", PRACTICE),
    }
    new = Instructor.objects.get(email="new@example.invalid")
    assert (new.last_name, new.first_name, new.patronymic) == ("Вигадана", "Марта", "")
    assert Instructor.objects.count() == 2


@pytest.mark.django_db
@pytest.mark.integration
def test_one_run_writes_the_same_rows_when_the_teacher_kinds_are_auto(
    user,
    course_offering_factory,
    course_instructor_factory,
    instructor_factory,
    sync_policy_factory,
):
    stale = instructor_factory(email="gone@example.invalid")
    course_instructor_factory(
        course_offering=course_offering_factory(code="990001"),
        instructor=stale,
        role=InstructorRole.LECTURE_INSTRUCTOR,
    )
    for kind in ("teacher_created", "teacher_link_added", "teacher_link_removed"):
        sync_policy_factory(kind=kind, mode="auto", updated_by=user)

    run = record(FakeUkmaData(current=[offering("990001", [teacher("auto@example.invalid")])]))
    apply_by_policy(run, lock_held=True)

    assert links_of("990001") == {("auto@example.invalid", ROLE)}
    assert not CourseInstructor.objects.filter(instructor=stale).exists()


@pytest.mark.django_db
@pytest.mark.integration
def test_a_second_run_supersedes_the_previous_run_s_unapproved_changes(
    course_offering_factory,
):
    course_offering_factory(code="990001")
    fake = FakeUkmaData(current=[offering("990001", [teacher("new@example.invalid")])])

    first = record(fake)
    second = record(fake)

    old = first.changes.filter(kind="teacher_link_added").get()
    assert (old.state, old.state_reason) == ("superseded", "replaced")
    assert second.changes.filter(kind="teacher_link_added").get().state == "proposed"
    assert links_of("990001") == set()


@pytest.mark.django_db
@pytest.mark.integration
def test_a_run_after_the_changes_applied_proposes_nothing(user, course_offering_factory):
    course_offering_factory(code="990001")
    fake = FakeUkmaData(current=[offering("990001", [teacher("same@example.invalid")])])
    first = record(fake)
    approve([change.pk for change in first.changes.all()], user)

    again = record(fake)

    assert again.changes.count() == 0
    assert (again.counts["created"], again.counts["linked"], again.counts["removed"]) == (0, 0, 0)


@pytest.mark.django_db
@pytest.mark.integration
def test_a_removed_offering_proposes_removing_its_links(
    user, course_offering_factory, course_instructor_factory, instructor_factory
):
    linked = instructor_factory(email="linked@example.invalid")
    course_instructor_factory(
        course_offering=course_offering_factory(code="990001"),
        instructor=linked,
        role=InstructorRole.LECTURE_INSTRUCTOR,
    )

    run = record(FakeUkmaData(current=[offering("990001", [], removed=True)]))
    change = run.changes.get()
    assert (change.kind, change.after["instructor_id"]) == (
        "teacher_link_removed",
        str(linked.pk),
    )

    approve([change.pk], user)

    assert links_of("990001") == set()


@pytest.mark.django_db
@pytest.mark.integration
def test_fails_a_year_that_lists_too_few_offerings(course_offering_factory, sync_run_factory):
    sync_run_factory(
        source=SyncSource.TEACHERS,
        status=SyncRunStatus.SUCCEEDED,
        counts={"matched": 2, "years": {str(YEAR): {"matched": 2, "links": 0}}},
    )
    course_offering_factory(code="990001")
    fake = FakeUkmaData(current=[offering("990001", [teacher("short@example.invalid")])])

    with pytest.raises(ShortReadError, match="short_read") as error:
        record(fake)

    assert error.value.years == [YEAR]
    assert SyncChange.objects.count() == 0


@pytest.mark.django_db
@pytest.mark.integration
def test_fails_a_year_that_wants_too_few_of_its_existing_links(
    course_offering_factory, course_instructor_factory, sync_run_factory
):
    sync_run_factory(
        source=SyncSource.TEACHERS,
        status=SyncRunStatus.SUCCEEDED,
        counts={"matched": 1, "years": {str(YEAR): {"matched": 1, "links": 0}}},
    )
    offering_row = course_offering_factory(code="990001")
    course_instructor_factory(
        course_offering=offering_row,
        instructor__email="first@example.invalid",
        role=InstructorRole.LECTURE_INSTRUCTOR,
    )
    course_instructor_factory(
        course_offering=offering_row,
        instructor__email="second@example.invalid",
        role=InstructorRole.PRACTICUM_INSTRUCTOR,
    )

    with pytest.raises(ShortReadError) as error:
        record(FakeUkmaData(current=[offering("990001", [])]))

    assert error.value.years == [YEAR]


@pytest.mark.django_db
@pytest.mark.integration
def test_a_multi_page_read_collects_every_offering_and_follows_the_cursor(
    course_offering_factory,
):
    course_offering_factory(code="990001")
    course_offering_factory(code="990002")
    fake = PagedUkmaData(
        current=[
            offering("990001", [teacher("one@example.invalid")], change_no=1),
            offering("990002", [teacher("two@example.invalid")], change_no=2),
        ]
    )

    run = record(fake)

    assert run.counts["matched"] == 2
    assert run.cursor_to == {"after": 2}
    assert run.changes.filter(kind="teacher_link_added").count() == 2


@pytest.mark.django_db
@pytest.mark.integration
def test_a_read_whose_cursor_does_not_move_fails_the_run(course_offering_factory):
    course_offering_factory(code="990001")
    fake = StalledUkmaData(current=[offering("990001", [teacher("stuck@example.invalid")])])

    with pytest.raises(StalledReadError, match="stalled_read"):
        record(fake)

    assert SyncChange.objects.count() == 0


def test_short_read_years_flags_too_few_offerings_against_the_last_matched_count():
    counts = {"years": {str(YEAR): {"listed": 8, "matched": 8, "links": 0, "wanted": 0}}}
    previous = {"years": {str(YEAR): {"matched": 10, "links": 0}}}

    assert short_read_years(counts, previous) == [YEAR]


def test_short_read_years_flags_too_few_wanted_links_against_the_existing_ones():
    counts = {"years": {str(YEAR): {"listed": 1, "matched": 1, "links": 10, "wanted": 8}}}
    previous = {"years": {str(YEAR): {"matched": 1, "links": 10}}}

    assert short_read_years(counts, previous) == [YEAR]


def test_short_read_years_flags_few_wanted_links_without_a_previous_run():
    counts = {"years": {str(YEAR): {"listed": 900, "matched": 900, "links": 900, "wanted": 0}}}

    assert short_read_years(counts, {}) == [YEAR]


def test_short_read_years_flags_few_wanted_links_for_a_year_the_previous_run_lacked():
    counts = {"years": {str(YEAR): {"listed": 900, "matched": 900, "links": 900, "wanted": 0}}}
    previous = {"years": {str(YEAR - 1): {"matched": 900, "links": 900}}}

    assert short_read_years(counts, previous) == [YEAR]


def test_short_read_years_compares_matched_counts_not_listed_ones():
    counts = {"years": {str(YEAR): {"listed": 500, "matched": 8, "links": 0, "wanted": 0}}}
    previous = {"years": {str(YEAR): {"matched": 10, "links": 0}}}

    assert short_read_years(counts, previous) == [YEAR]


def test_short_read_years_ignores_a_year_the_run_no_longer_reads():
    counts = {"years": {str(YEAR): {"listed": 10, "matched": 10, "links": 10, "wanted": 10}}}
    previous = {
        "years": {
            str(YEAR - 1): {"matched": 1000, "links": 1000},
            str(YEAR): {"matched": 10, "links": 10},
        }
    }

    assert short_read_years(counts, previous) == []


def test_short_read_years_is_quiet_both_at_the_ratio_and_without_a_previous_run():
    at_ratio = {"years": {str(YEAR): {"listed": 9, "matched": 9, "links": 10, "wanted": 9}}}

    assert short_read_years(at_ratio, {"years": {str(YEAR): {"matched": 10, "links": 10}}}) == []
    assert short_read_years(at_ratio, {}) == []
