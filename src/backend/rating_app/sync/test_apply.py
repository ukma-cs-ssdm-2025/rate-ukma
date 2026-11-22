from __future__ import annotations

from contextlib import contextmanager
from datetime import timedelta
from typing import Any

from django.utils import timezone

import pytest
from structlog.testing import capture_logs

from rating_app.models import (
    Course,
    CourseInstructor,
    CourseOffering,
    Instructor,
    SyncApprovalOutcome,
    SyncChange,
    SyncChangeGroup,
    SyncChangeState,
    SyncChangeStateReason,
    SyncPolicyMode,
    SyncRunStatus,
    SyncSource,
)
from rating_app.models.choices import InstructorRole
from rating_app.sync import apply, handlers
from rating_app.sync.apply import apply_by_policy, approve, reject
from rating_app.sync.handlers import Handler
from rating_app.sync.kinds import KIND_BY_NAME

ROLE = InstructorRole.LECTURE_INSTRUCTOR.value


@contextmanager
def _lock_free(_key: int):
    yield True


@contextmanager
def _lock_taken(_key: int):
    yield False


@pytest.fixture(autouse=True)
def lock_free(monkeypatch):
    monkeypatch.setattr(apply, "advisory_lock", _lock_free)


@pytest.fixture
def make_run(sync_run_factory):
    def make(
        *,
        source: str = SyncSource.TEACHERS,
        status: str = SyncRunStatus.SUCCEEDED,
        **kwargs: Any,
    ):
        kwargs.setdefault("finished_at", timezone.now())
        return sync_run_factory(source=source, status=status, **kwargs)

    return make


@pytest.fixture
def make_change(sync_change_factory):
    def make(
        run,
        *,
        kind: str,
        key: str,
        target_id: str | None = None,
        before: dict[str, Any] | None = None,
        after: dict[str, Any] | None = None,
        requires: list[dict[str, str]] | None = None,
        group: str | None = None,
        source: str | None = None,
    ):
        registry_kind = KIND_BY_NAME.get(kind)
        return sync_change_factory(
            run=run,
            source=source or (registry_kind.source if registry_kind else SyncSource.CATALOG),
            group=group or (registry_kind.group if registry_kind else SyncChangeGroup.NEW),
            kind=kind,
            key=key,
            target_id=target_id,
            before=before or {},
            after=after or {},
            requires=requires or [],
        )

    return make


def _links(*pairs: tuple[Any, str]) -> dict[str, Any]:
    return {
        "links": [
            {"instructor_id": str(instructor_id), "role": role}
            for instructor_id, role in sorted(pairs, key=lambda pair: (str(pair[0]), pair[1]))
        ]
    }


def _created(email: str) -> dict[str, Any]:
    return {
        "email": email,
        "last_name": "Testenko",
        "first_name": "Test",
        "middle_name": "",
    }


def _added(email: str, role: str = ROLE) -> dict[str, Any]:
    return {"teacher_email": email, "role": role}


def _removed(instructor_id: Any, role: str = ROLE) -> dict[str, Any]:
    return {"instructor_id": str(instructor_id), "role": role}


@pytest.mark.django_db
@pytest.mark.integration
def test_approve_applies_the_whole_offering_unit_from_one_selected_link(
    user,
    make_run,
    make_change,
    course_offering_factory,
    course_instructor_factory,
    instructor_factory,
):
    run = make_run()
    offering = course_offering_factory()
    removed = instructor_factory()
    course_instructor_factory(course_offering=offering, instructor=removed, role=ROLE)
    email = "new.teacher@example.com"
    created = make_change(run, kind="teacher_created", key=email, after=_created(email))
    added = make_change(
        run,
        kind="teacher_link_added",
        key=f"offering:{offering.pk}|teacher:{email}",
        target_id=str(offering.pk),
        before=_links((removed.pk, ROLE)),
        after=_added(email),
        requires=[{"kind": "teacher_created", "key": email}],
    )
    removed_change = make_change(
        run,
        kind="teacher_link_removed",
        key=f"offering:{offering.pk}|remove:{removed.pk}",
        target_id=str(offering.pk),
        before=_links((removed.pk, ROLE)),
        after=_removed(removed.pk),
    )

    approval = approve([added.pk], user)

    assert approval.outcome == SyncApprovalOutcome.APPLIED
    assert approval.counts == {"applied": 3, "superseded": 0, "waiting": 0}
    new_teacher = Instructor.objects.get(email=email)
    assert set(
        CourseInstructor.objects.filter(course_offering=offering).values_list(
            "instructor_id", "role"
        )
    ) == {(new_teacher.pk, ROLE)}
    for change in (created, added, removed_change):
        change.refresh_from_db()
        assert change.state == SyncChangeState.APPLIED
        assert change.approval_id == approval.pk


@pytest.mark.django_db
@pytest.mark.integration
def test_approve_runs_the_auto_path_for_a_change_waiting_on_it(
    user,
    make_run,
    make_change,
    course_offering_factory,
    sync_policy_factory,
):
    run = make_run()
    approved_offering = course_offering_factory()
    auto_offering = course_offering_factory()
    email = "cascade.teacher@example.com"
    make_change(run, kind="teacher_created", key=email, after=_created(email))
    approved = make_change(
        run,
        kind="teacher_link_added",
        key=f"offering:{approved_offering.pk}|teacher:{email}",
        target_id=str(approved_offering.pk),
        before={"links": []},
        after=_added(email),
        requires=[{"kind": "teacher_created", "key": email}],
    )
    auto = make_change(
        run,
        kind="teacher_link_added",
        key=f"offering:{auto_offering.pk}|teacher:{email}",
        target_id=str(auto_offering.pk),
        before={"links": []},
        after=_added(email),
        requires=[{"kind": "teacher_created", "key": email}],
    )
    sync_policy_factory(kind="teacher_link_added", mode=SyncPolicyMode.AUTO, updated_by=user)

    approval = approve([approved.pk], user)

    assert approval.outcome == SyncApprovalOutcome.APPLIED
    approved.refresh_from_db()
    auto.refresh_from_db()
    assert approved.state == SyncChangeState.APPLIED
    assert approved.approval_id == approval.pk
    assert auto.state == SyncChangeState.APPLIED
    assert auto.approval_id != approval.pk
    assert CourseInstructor.objects.filter(course_offering=approved_offering).count() == 1
    assert CourseInstructor.objects.filter(course_offering=auto_offering).count() == 1


@pytest.mark.django_db
@pytest.mark.integration
def test_reject_takes_the_teacher_of_the_unit_and_supersedes_changes_waiting_on_it(
    user,
    make_run,
    make_change,
    course_offering_factory,
):
    run = make_run()
    offering = course_offering_factory()
    email = "rejected.teacher@example.com"
    created = make_change(run, kind="teacher_created", key=email, after=_created(email))
    link = make_change(
        run,
        kind="teacher_link_added",
        key=f"offering:{offering.pk}|teacher:{email}",
        target_id=str(offering.pk),
        before={"links": []},
        after=_added(email),
        requires=[{"kind": "teacher_created", "key": email}],
    )

    approval = reject([link.pk], user)

    assert approval.outcome == SyncApprovalOutcome.APPLIED
    assert approval.counts == {"rejected": 2, "superseded": 0}
    created.refresh_from_db()
    link.refresh_from_db()
    assert created.state == SyncChangeState.REJECTED
    assert link.state == SyncChangeState.REJECTED


@pytest.mark.django_db
@pytest.mark.integration
def test_rejecting_a_teacher_takes_every_offering_unit_that_requires_it(
    user,
    make_run,
    make_change,
    course_offering_factory,
):
    run = make_run()
    email = "waiting.teacher@example.com"
    first_offering = course_offering_factory()
    second_offering = course_offering_factory()
    created = make_change(run, kind="teacher_created", key=email, after=_created(email))
    first = make_change(
        run,
        kind="teacher_link_added",
        key=f"offering:{first_offering.pk}|teacher:{email}",
        target_id=str(first_offering.pk),
        before={"links": []},
        after=_added(email),
        requires=[{"kind": "teacher_created", "key": email}],
    )
    second = make_change(
        run,
        kind="teacher_link_added",
        key=f"offering:{second_offering.pk}|teacher:{email}",
        target_id=str(second_offering.pk),
        before={"links": []},
        after=_added(email),
        requires=[{"kind": "teacher_created", "key": email}],
    )

    approval = reject([created.pk], user)

    assert approval.outcome == SyncApprovalOutcome.APPLIED
    assert approval.counts == {"rejected": 3, "superseded": 0}
    for change in (created, first, second):
        change.refresh_from_db()
        assert change.state == SyncChangeState.REJECTED


@pytest.mark.django_db
@pytest.mark.integration
def test_rejecting_a_teacher_supersedes_changes_that_wait_on_it(
    user,
    make_run,
    make_change,
):
    run = make_run()
    email = "waiting.teacher@example.com"
    created = make_change(run, kind="teacher_created", key=email, after=_created(email))
    dependent_email = "dependent.teacher@example.com"
    dependent = make_change(
        run,
        kind="teacher_created",
        key=dependent_email,
        after=_created(dependent_email),
        requires=[{"kind": "teacher_created", "key": email}],
    )

    approval = reject([created.pk], user)

    assert approval.counts == {"rejected": 1, "superseded": 1}
    created.refresh_from_db()
    dependent.refresh_from_db()
    assert created.state == SyncChangeState.REJECTED
    assert dependent.state == SyncChangeState.SUPERSEDED
    assert dependent.state_reason == SyncChangeStateReason.DEPENDENCY_REJECTED


@pytest.mark.django_db
@pytest.mark.integration
def test_apply_supersedes_stale_and_now_existing_changes_before_applying(
    user,
    make_run,
    make_change,
    course_offering_factory,
    course_instructor_factory,
    instructor_factory,
):
    run = make_run()
    stale_offering = course_offering_factory()
    current = instructor_factory()
    course_instructor_factory(course_offering=stale_offering, instructor=current, role=ROLE)
    stale = make_change(
        run,
        kind="teacher_link_added",
        key=f"offering:{stale_offering.pk}|teacher:stale@example.com",
        target_id=str(stale_offering.pk),
        before={"links": []},
        after=_added("stale@example.com"),
    )
    existing_teacher = instructor_factory(email="existing.teacher@example.com")
    existing = make_change(
        run,
        kind="teacher_created",
        key=existing_teacher.email,
        after=_created(existing_teacher.email),
    )
    fresh_offering = course_offering_factory()
    fresh_email = "fresh.teacher@example.com"
    fresh_created = make_change(
        run, kind="teacher_created", key=fresh_email, after=_created(fresh_email)
    )
    fresh = make_change(
        run,
        kind="teacher_link_added",
        key=f"offering:{fresh_offering.pk}|teacher:{fresh_email}",
        target_id=str(fresh_offering.pk),
        before={"links": []},
        after=_added(fresh_email),
        requires=[{"kind": "teacher_created", "key": fresh_email}],
    )

    approval = approve([stale.pk, existing.pk, fresh.pk], user)

    stale.refresh_from_db()
    existing.refresh_from_db()
    fresh.refresh_from_db()
    fresh_created.refresh_from_db()
    assert approval.outcome == SyncApprovalOutcome.APPLIED
    assert approval.counts == {"applied": 2, "superseded": 2, "waiting": 0}
    assert stale.state == SyncChangeState.SUPERSEDED
    assert stale.state_reason == SyncChangeStateReason.STALE
    assert existing.state == SyncChangeState.SUPERSEDED
    assert existing.state_reason == SyncChangeStateReason.EXISTS
    assert fresh.state == SyncChangeState.APPLIED
    assert fresh_created.state == SyncChangeState.APPLIED
    assert Instructor.objects.filter(email=fresh_email).count() == 1
    assert Instructor.objects.filter(email="stale@example.com").count() == 0


@pytest.mark.django_db
@pytest.mark.integration
def test_a_unit_with_a_stale_member_leaves_the_rest_proposed(
    user,
    make_run,
    make_change,
    course_offering_factory,
    course_instructor_factory,
    instructor_factory,
):
    run = make_run()
    offering = course_offering_factory()
    existing = instructor_factory()
    course_instructor_factory(course_offering=offering, instructor=existing, role=ROLE)
    first = instructor_factory(email="first@example.com")
    second = instructor_factory(email="second@example.com")
    stale = make_change(
        run,
        kind="teacher_link_added",
        key=f"offering:{offering.pk}|teacher:first@example.com",
        target_id=str(offering.pk),
        before={"links": []},
        after=_added(first.email),
        requires=[{"kind": "teacher_created", "key": first.email}],
    )
    fresh = make_change(
        run,
        kind="teacher_link_added",
        key=f"offering:{offering.pk}|teacher:second@example.com",
        target_id=str(offering.pk),
        before=_links((existing.pk, ROLE)),
        after=_added(second.email),
        requires=[{"kind": "teacher_created", "key": second.email}],
    )

    approval = approve([fresh.pk], user)

    stale.refresh_from_db()
    fresh.refresh_from_db()
    assert approval.outcome == SyncApprovalOutcome.APPLIED
    assert approval.counts == {"applied": 0, "superseded": 1, "waiting": 1}
    assert stale.state == SyncChangeState.SUPERSEDED
    assert stale.state_reason == SyncChangeStateReason.STALE
    assert fresh.state == SyncChangeState.PROPOSED
    assert not CourseInstructor.objects.filter(
        course_offering=offering, instructor__in=[first, second]
    ).exists()


@pytest.mark.django_db
@pytest.mark.integration
def test_apply_by_policy_applies_nothing_when_every_kind_needs_approval(
    make_run,
    make_change,
    course_offering_factory,
    instructor_factory,
):
    run = make_run()
    teacher = instructor_factory(email="policy.teacher@example.com")
    change = make_change(
        run,
        kind="teacher_link_added",
        key=f"offering:{course_offering_factory().pk}|teacher:{teacher.email}",
        target_id=str(course_offering_factory().pk),
        after=_added(teacher.email),
        requires=[{"kind": "teacher_created", "key": teacher.email}],
    )

    assert apply_by_policy(run, lock_held=True) is None

    change.refresh_from_db()
    assert change.state == SyncChangeState.PROPOSED


@pytest.mark.django_db
@pytest.mark.integration
def test_apply_by_policy_applies_auto_kinds_without_a_user(
    user,
    make_run,
    make_change,
    course_offering_factory,
    sync_policy_factory,
):
    run = make_run()
    offering = course_offering_factory()
    email = "auto.teacher@example.com"
    created = make_change(run, kind="teacher_created", key=email, after=_created(email))
    link = make_change(
        run,
        kind="teacher_link_added",
        key=f"offering:{offering.pk}|teacher:{email}",
        target_id=str(offering.pk),
        before={"links": []},
        after=_added(email),
        requires=[{"kind": "teacher_created", "key": email}],
    )
    sync_policy_factory(kind="teacher_created", mode=SyncPolicyMode.AUTO, updated_by=user)
    sync_policy_factory(kind="teacher_link_added", mode=SyncPolicyMode.AUTO, updated_by=user)

    approval = apply_by_policy(run, lock_held=True)

    assert approval is not None
    assert approval.user is None
    assert approval.outcome == SyncApprovalOutcome.APPLIED
    assert approval.counts == {"applied": 2, "superseded": 0, "waiting": 0}
    created.refresh_from_db()
    link.refresh_from_db()
    assert created.state == SyncChangeState.APPLIED
    assert link.state == SyncChangeState.APPLIED
    assert Instructor.objects.filter(email=email).count() == 1


@pytest.mark.django_db
@pytest.mark.integration
def test_apply_by_policy_never_applies_a_never_auto_kind(
    monkeypatch,
    make_run,
    make_change,
):
    calls: list[int] = []
    monkeypatch.setitem(
        handlers.HANDLERS,
        "merge_courses",
        Handler(apply=lambda change: calls.append(change.pk)),
    )
    monkeypatch.setattr(apply, "mode_for", lambda kind: SyncPolicyMode.AUTO)
    run = make_run(source=SyncSource.CATALOG)
    change = make_change(run, kind="merge_courses", key="ud-course-1")

    assert apply_by_policy(run, lock_held=True) is None

    change.refresh_from_db()
    assert change.state == SyncChangeState.PROPOSED
    assert calls == []


@pytest.mark.django_db
@pytest.mark.integration
def test_apply_by_policy_leaves_a_rated_catalog_row_for_a_person(
    monkeypatch,
    make_run,
    make_change,
    course_offering_factory,
    rating_factory,
):
    applied: list[int] = []
    monkeypatch.setitem(
        handlers.HANDLERS,
        "change_offering",
        Handler(apply=lambda change: applied.append(change.pk)),
    )
    monkeypatch.setattr(apply, "mode_for", lambda kind: SyncPolicyMode.AUTO)
    monkeypatch.setattr(apply, "is_stale", lambda *args: False)
    run = make_run(source=SyncSource.CATALOG)
    rated_offering = course_offering_factory()
    unrated_offering = course_offering_factory()
    rating_factory(course_offering=rated_offering)
    rated = make_change(
        run, kind="change_offering", key=str(rated_offering.pk), target_id=str(rated_offering.pk)
    )
    unrated = make_change(
        run,
        kind="change_offering",
        key=str(unrated_offering.pk),
        target_id=str(unrated_offering.pk),
    )

    approval = apply_by_policy(run, lock_held=True)

    assert approval is not None
    rated.refresh_from_db()
    unrated.refresh_from_db()
    assert rated.state == SyncChangeState.PROPOSED
    assert unrated.state == SyncChangeState.APPLIED
    assert applied == [unrated.pk]


@pytest.mark.django_db
@pytest.mark.integration
def test_a_fresh_faculty_change_is_not_superseded_by_the_pre_pass(
    monkeypatch, user, make_run, make_change, faculty_factory
):
    applied: list[int] = []
    monkeypatch.setitem(
        handlers.HANDLERS,
        "link_faculty",
        Handler(apply=lambda change: applied.append(change.pk)),
    )
    faculty = faculty_factory()
    run = make_run(source=SyncSource.CATALOG)
    change = make_change(
        run,
        kind="link_faculty",
        key=str(faculty.pk),
        target_id=str(faculty.pk),
        before={"ukma_data_id": faculty.ukma_data_id},
        after={"ukma_data_id": "ud-faculty"},
    )

    approval = approve([change.pk], user)

    change.refresh_from_db()
    assert approval.outcome == SyncApprovalOutcome.APPLIED
    assert change.state == SyncChangeState.APPLIED
    assert applied == [change.pk]


@pytest.mark.django_db
@pytest.mark.integration
def test_apply_by_policy_applies_teacher_links_on_a_rated_offering(
    user,
    make_run,
    make_change,
    course_offering_factory,
    instructor_factory,
    rating_factory,
    sync_policy_factory,
):
    run = make_run()
    offering = course_offering_factory()
    teacher = instructor_factory(email="rated@example.com")
    rating_factory(course_offering=offering)
    change = make_change(
        run,
        kind="teacher_link_added",
        key=f"offering:{offering.pk}|teacher:{teacher.email}",
        target_id=str(offering.pk),
        before={"links": []},
        after=_added(teacher.email),
        requires=[{"kind": "teacher_created", "key": teacher.email}],
    )
    sync_policy_factory(kind="teacher_link_added", mode=SyncPolicyMode.AUTO, updated_by=user)

    approval = apply_by_policy(run, lock_held=True)

    assert approval is not None
    assert approval.counts == {"applied": 1, "superseded": 0, "waiting": 0}
    change.refresh_from_db()
    assert change.state == SyncChangeState.APPLIED


@pytest.mark.django_db
@pytest.mark.integration
@pytest.mark.parametrize("old_data", [False, True])
def test_approve_refuses_a_run_over_48_hours_old_until_confirmed(
    old_data,
    user,
    make_run,
    make_change,
):
    now = timezone.now()
    run = make_run(
        finished_at=now - timedelta(hours=49) if not old_data else now,
        data_updated_at=now - timedelta(hours=49) if old_data else None,
    )
    email = "old.teacher@example.com"
    created = make_change(run, kind="teacher_created", key=email, after=_created(email))

    refused = approve([created.pk], user)

    assert refused.outcome == SyncApprovalOutcome.REFUSED
    assert refused.error == "run_too_old"
    created.refresh_from_db()
    assert created.state == SyncChangeState.PROPOSED
    assert not Instructor.objects.filter(email=email).exists()

    confirmed = approve([created.pk], user, confirm_old_run=True)

    assert confirmed.outcome == SyncApprovalOutcome.APPLIED
    assert Instructor.objects.filter(email=email).count() == 1


@pytest.mark.django_db
@pytest.mark.integration
def test_apply_by_policy_skips_a_run_over_36_hours_old(
    user,
    make_run,
    make_change,
    sync_policy_factory,
):
    run = make_run(finished_at=timezone.now() - timedelta(hours=37))
    email = "late.teacher@example.com"
    created = make_change(run, kind="teacher_created", key=email, after=_created(email))
    sync_policy_factory(kind="teacher_created", mode=SyncPolicyMode.AUTO, updated_by=user)

    assert apply_by_policy(run, lock_held=True) is None

    created.refresh_from_db()
    assert created.state == SyncChangeState.PROPOSED


@pytest.mark.django_db
@pytest.mark.integration
def test_approve_refuses_changes_of_an_older_run(
    user,
    make_run,
    make_change,
    sync_run_factory,
):
    older = make_run()
    email = "older.teacher@example.com"
    created = make_change(older, kind="teacher_created", key=email, after=_created(email))
    make_run(source=SyncSource.TEACHERS)

    approval = approve([created.pk], user)

    assert approval.outcome == SyncApprovalOutcome.REFUSED
    assert approval.error == "run_not_current"
    created.refresh_from_db()
    assert created.state == SyncChangeState.PROPOSED


@pytest.mark.django_db
@pytest.mark.integration
def test_approve_refuses_while_the_source_lock_is_held(
    monkeypatch,
    user,
    make_run,
    make_change,
):
    monkeypatch.setattr(apply, "advisory_lock", _lock_taken)
    run = make_run()
    email = "locked.teacher@example.com"
    created = make_change(run, kind="teacher_created", key=email, after=_created(email))

    approval = approve([created.pk], user)

    assert approval.outcome == SyncApprovalOutcome.REFUSED
    assert approval.error == "lock_held"
    created.refresh_from_db()
    assert created.state == SyncChangeState.PROPOSED


@pytest.mark.django_db
@pytest.mark.integration
def test_approve_twice_does_not_duplicate_rows(
    user,
    make_run,
    make_change,
    course_offering_factory,
):
    run = make_run()
    offering = course_offering_factory()
    email = "once.teacher@example.com"
    make_change(run, kind="teacher_created", key=email, after=_created(email))
    link = make_change(
        run,
        kind="teacher_link_added",
        key=f"offering:{offering.pk}|teacher:{email}",
        target_id=str(offering.pk),
        before={"links": []},
        after=_added(email),
        requires=[{"kind": "teacher_created", "key": email}],
    )

    assert approve([link.pk], user).outcome == SyncApprovalOutcome.APPLIED
    again = approve([link.pk], user)

    assert again.outcome == SyncApprovalOutcome.REFUSED
    assert again.error == "no_proposed_changes"
    assert Instructor.objects.filter(email=email).count() == 1
    assert CourseInstructor.objects.filter(course_offering=offering).count() == 1


@pytest.mark.django_db
@pytest.mark.integration
def test_an_unknown_kind_stays_proposed_with_a_reason(
    user,
    make_run,
    make_change,
):
    run = make_run(source=SyncSource.CATALOG)
    change = make_change(run, kind="new_volcano", key="volcano-1")

    with capture_logs() as logs:
        approval = approve([change.pk], user)

    change.refresh_from_db()
    assert approval.outcome == SyncApprovalOutcome.APPLIED
    assert approval.counts == {"applied": 0, "superseded": 0, "waiting": 1}
    assert change.state == SyncChangeState.PROPOSED
    assert any(
        log["event"] == "sync_change_left_proposed"
        and log["reason"] == "no_handler"
        and log["kind"] == "new_volcano"
        for log in logs
    )


@pytest.mark.django_db
@pytest.mark.integration
def test_handlers_that_do_not_move_ratings_keep_the_offering_and_its_course(
    make_run,
    make_change,
    course_offering_factory,
    course_instructor_factory,
    instructor_factory,
    rating_factory,
):
    run = make_run()
    offering = course_offering_factory()
    original_course_id = offering.course_id
    current = instructor_factory()
    course_instructor_factory(course_offering=offering, instructor=current, role=ROLE)
    rating_factory(course_offering=offering)
    email = "safe.teacher@example.com"
    changes = {
        "teacher_created": make_change(
            run, kind="teacher_created", key=email, after=_created(email)
        ),
        "teacher_link_added": make_change(
            run,
            kind="teacher_link_added",
            key=f"offering:{offering.pk}|teacher:{email}",
            target_id=str(offering.pk),
            after=_added(email),
            requires=[{"kind": "teacher_created", "key": email}],
        ),
        "teacher_link_removed": make_change(
            run,
            kind="teacher_link_removed",
            key=f"offering:{offering.pk}|remove:{current.pk}",
            target_id=str(offering.pk),
            before=_links((current.pk, ROLE)),
            after=_removed(current.pk),
        ),
    }
    safe_handlers = {kind for kind in handlers.HANDLERS if not KIND_BY_NAME[kind].moves_ratings}
    assert safe_handlers == set(changes)

    for kind, change in changes.items():
        handlers.HANDLERS[kind].apply(change)

    assert CourseOffering.objects.get(pk=offering.pk).course_id == original_course_id
    assert Course.objects.filter(pk=original_course_id).exists()


@pytest.mark.django_db
@pytest.mark.integration
def test_apply_failure_never_logs_or_stores_a_teacher_email(
    monkeypatch,
    user,
    make_run,
    make_change,
):
    email = "secret.teacher@example.com"
    run = make_run()
    created = make_change(run, kind="teacher_created", key=email, after=_created(email))

    def fail(change):
        raise RuntimeError(f"could not create {email}")

    monkeypatch.setitem(handlers.HANDLERS, "teacher_created", Handler(apply=fail))

    with capture_logs() as logs:
        approval = approve([created.pk], user)

    assert approval.outcome == SyncApprovalOutcome.FAILED
    assert approval.error == (f"apply_failed:RuntimeError:change={created.pk}:kind=teacher_created")
    assert email not in approval.error
    assert email not in repr(logs)


@pytest.mark.django_db
@pytest.mark.integration
def test_approving_a_teacher_created_takes_every_offering_unit_that_requires_it(
    user,
    make_run,
    make_change,
    course_offering_factory,
):
    run = make_run()
    email = "expanded.teacher@example.com"
    first_offering = course_offering_factory()
    second_offering = course_offering_factory()
    created = make_change(run, kind="teacher_created", key=email, after=_created(email))
    first = make_change(
        run,
        kind="teacher_link_added",
        key=f"offering:{first_offering.pk}|teacher:{email}",
        target_id=str(first_offering.pk),
        before={"links": []},
        after=_added(email),
        requires=[{"kind": "teacher_created", "key": email}],
    )
    second = make_change(
        run,
        kind="teacher_link_added",
        key=f"offering:{second_offering.pk}|teacher:{email}",
        target_id=str(second_offering.pk),
        before={"links": []},
        after=_added(email),
        requires=[{"kind": "teacher_created", "key": email}],
    )

    approval = approve([created.pk], user)

    assert approval.outcome == SyncApprovalOutcome.APPLIED
    assert approval.counts == {"applied": 3, "superseded": 0, "waiting": 0}
    for change in (created, first, second):
        change.refresh_from_db()
        assert change.state == SyncChangeState.APPLIED
        assert change.approval_id == approval.pk
    assert CourseInstructor.objects.filter(course_offering=first_offering).count() == 1
    assert CourseInstructor.objects.filter(course_offering=second_offering).count() == 1


@pytest.mark.django_db
@pytest.mark.integration
def test_a_teacher_that_already_exists_does_not_block_its_unit(
    user,
    make_run,
    make_change,
    course_offering_factory,
    instructor_factory,
):
    run = make_run()
    offering = course_offering_factory()
    email = "already.here@example.com"
    instructor_factory(email=email)
    created = make_change(run, kind="teacher_created", key=email, after=_created(email))
    link = make_change(
        run,
        kind="teacher_link_added",
        key=f"offering:{offering.pk}|teacher:{email}",
        target_id=str(offering.pk),
        before={"links": []},
        after=_added(email),
        requires=[{"kind": "teacher_created", "key": email}],
    )

    approval = approve([link.pk], user)

    assert approval.outcome == SyncApprovalOutcome.APPLIED
    assert approval.counts == {"applied": 1, "superseded": 1, "waiting": 0}
    created.refresh_from_db()
    link.refresh_from_db()
    assert created.state == SyncChangeState.SUPERSEDED
    assert created.state_reason == SyncChangeStateReason.EXISTS
    assert link.state == SyncChangeState.APPLIED
    assert CourseInstructor.objects.filter(course_offering=offering).count() == 1


@pytest.mark.django_db
@pytest.mark.integration
def test_a_link_to_a_teacher_no_change_creates_is_superseded_as_stale(
    user,
    make_run,
    make_change,
    course_offering_factory,
):
    run = make_run()
    offering = course_offering_factory()
    email = "never.created@example.com"
    link = make_change(
        run,
        kind="teacher_link_added",
        key=f"offering:{offering.pk}|teacher:{email}",
        target_id=str(offering.pk),
        before={"links": []},
        after=_added(email),
    )

    approval = approve([link.pk], user)

    assert approval.outcome == SyncApprovalOutcome.APPLIED
    assert approval.counts == {"applied": 0, "superseded": 1, "waiting": 0}
    link.refresh_from_db()
    assert link.state == SyncChangeState.SUPERSEDED
    assert link.state_reason == SyncChangeStateReason.STALE
    assert not Instructor.objects.filter(email=email).exists()
    assert not CourseInstructor.objects.filter(course_offering=offering).exists()


@pytest.mark.django_db
@pytest.mark.integration
def test_a_reject_committed_before_the_lock_is_seen_when_the_selection_is_reloaded(
    monkeypatch,
    user,
    make_run,
    make_change,
    course_offering_factory,
):
    run = make_run()
    offering = course_offering_factory()
    email = "raced.teacher@example.com"
    created = make_change(run, kind="teacher_created", key=email, after=_created(email))
    link = make_change(
        run,
        kind="teacher_link_added",
        key=f"offering:{offering.pk}|teacher:{email}",
        target_id=str(offering.pk),
        before={"links": []},
        after=_added(email),
        requires=[{"kind": "teacher_created", "key": email}],
    )

    @contextmanager
    def lock_after_reject(_key: int):
        SyncChange.objects.filter(pk=created.pk).update(
            state=SyncChangeState.REJECTED, decided_at=timezone.now()
        )
        yield True

    monkeypatch.setattr(apply, "advisory_lock", lock_after_reject)

    approval = approve([link.pk], user)

    assert approval.outcome == SyncApprovalOutcome.APPLIED
    created.refresh_from_db()
    link.refresh_from_db()
    assert created.state == SyncChangeState.REJECTED
    assert link.state == SyncChangeState.PROPOSED
    assert not Instructor.objects.filter(email=email).exists()
    assert not CourseInstructor.objects.filter(course_offering=offering).exists()


@pytest.mark.django_db
@pytest.mark.integration
def test_a_reject_committed_before_the_unit_write_rolls_the_unit_back(
    monkeypatch,
    user,
    make_run,
    make_change,
    course_offering_factory,
):
    run = make_run()
    offering = course_offering_factory()
    email = "raced.link@example.com"
    created = make_change(run, kind="teacher_created", key=email, after=_created(email))
    link = make_change(
        run,
        kind="teacher_link_added",
        key=f"offering:{offering.pk}|teacher:{email}",
        target_id=str(offering.pk),
        before={"links": []},
        after=_added(email),
        requires=[{"kind": "teacher_created", "key": email}],
    )
    original_expand = apply._expand_units

    def expand_then_reject(selected, current_run):
        units = original_expand(selected, current_run)
        SyncChange.objects.filter(pk=link.pk).update(
            state=SyncChangeState.REJECTED, decided_at=timezone.now()
        )
        return units

    monkeypatch.setattr(apply, "_expand_units", expand_then_reject)

    approval = approve([link.pk], user)

    assert approval.outcome == SyncApprovalOutcome.APPLIED
    assert approval.counts == {"applied": 0, "superseded": 0, "waiting": 2}
    created.refresh_from_db()
    link.refresh_from_db()
    assert created.state == SyncChangeState.PROPOSED
    assert link.state == SyncChangeState.REJECTED
    assert not Instructor.objects.filter(email=email).exists()
    assert not CourseInstructor.objects.filter(course_offering=offering).exists()


@pytest.mark.django_db
@pytest.mark.integration
def test_an_apply_committed_before_the_reject_write_leaves_it_at_zero(
    monkeypatch,
    user,
    make_run,
    make_change,
    course_offering_factory,
):
    run = make_run()
    email = "applied.teacher@example.com"
    first_offering = course_offering_factory()
    second_offering = course_offering_factory()
    created = make_change(run, kind="teacher_created", key=email, after=_created(email))
    link = make_change(
        run,
        kind="teacher_link_added",
        key=f"offering:{first_offering.pk}|teacher:{email}",
        target_id=str(first_offering.pk),
        before={"links": []},
        after=_added(email),
        requires=[{"kind": "teacher_created", "key": email}],
    )
    dependent = make_change(
        run,
        kind="teacher_link_added",
        key=f"offering:{second_offering.pk}|teacher:{email}",
        target_id=str(second_offering.pk),
        before={"links": []},
        after=_added(email),
        requires=[{"kind": "teacher_created", "key": email}],
    )
    original_expand = apply._expand_units

    def expand_then_apply(selected, current_run):
        units = original_expand(selected, current_run)
        SyncChange.objects.filter(pk__in=[created.pk, link.pk]).update(
            state=SyncChangeState.APPLIED, decided_at=timezone.now()
        )
        return units

    monkeypatch.setattr(apply, "_expand_units", expand_then_apply)

    approval = reject([link.pk], user)

    assert approval.outcome == SyncApprovalOutcome.APPLIED
    assert approval.counts == {"rejected": 0, "superseded": 0}
    created.refresh_from_db()
    link.refresh_from_db()
    dependent.refresh_from_db()
    assert created.state == SyncChangeState.APPLIED
    assert link.state == SyncChangeState.APPLIED
    assert dependent.state == SyncChangeState.PROPOSED


@pytest.mark.django_db
@pytest.mark.integration
def test_apply_by_policy_rechecks_the_current_run_under_the_lock(
    monkeypatch,
    user,
    make_run,
    make_change,
    sync_policy_factory,
):
    run = make_run()
    email = "stale.run@example.com"
    created = make_change(run, kind="teacher_created", key=email, after=_created(email))
    sync_policy_factory(kind="teacher_created", mode=SyncPolicyMode.AUTO, updated_by=user)

    @contextmanager
    def lock_after_new_run(_key: int):
        make_run(source=SyncSource.TEACHERS)
        yield True

    monkeypatch.setattr(apply, "advisory_lock", lock_after_new_run)

    assert apply_by_policy(run) is None

    created.refresh_from_db()
    assert created.state == SyncChangeState.PROPOSED
