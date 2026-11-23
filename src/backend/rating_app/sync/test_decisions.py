from __future__ import annotations

import uuid
from contextlib import contextmanager

from django.utils import timezone

import pytest

from rating_app.models import (
    SyncApproval,
    SyncApprovalOutcome,
    SyncChangeState,
    SyncPreview,
    SyncRunStatus,
    SyncSource,
)
from rating_app.sync import apply, decisions, handlers, selection
from rating_app.sync.handlers import Handler
from rating_app.sync.kinds import KIND_BY_NAME


@contextmanager
def _lock_free(_key: int):
    yield True


@pytest.fixture
def admin(user_factory, monkeypatch):
    monkeypatch.setattr(apply, "advisory_lock", _lock_free)
    return user_factory(is_superuser=True)


@pytest.fixture
def quiet_catalog(monkeypatch):
    for kind in ("change_offering", "new_offering", "relink_course"):
        monkeypatch.setitem(handlers.HANDLERS, kind, Handler(apply=lambda change: None))


@pytest.fixture
def teacher_run(sync_run_factory):
    return sync_run_factory(
        source=SyncSource.TEACHERS,
        status=SyncRunStatus.SUCCEEDED,
        finished_at=timezone.now(),
    )


@pytest.fixture
def catalog_run(sync_run_factory):
    return sync_run_factory(
        source=SyncSource.CATALOG,
        status=SyncRunStatus.SUCCEEDED,
        finished_at=timezone.now(),
    )


@pytest.fixture
def make_teacher(sync_change_factory, teacher_run):
    def build(email):
        return sync_change_factory(
            run=teacher_run,
            source=SyncSource.TEACHERS,
            group="new",
            kind="teacher_created",
            key=email,
            after={
                "email": email,
                "last_name": "Тестенко",
                "first_name": "Тест",
                "middle_name": "",
            },
        )

    return build


@pytest.fixture
def make_link(sync_change_factory, teacher_run):
    def build(offering, email):
        return sync_change_factory(
            run=teacher_run,
            source=SyncSource.TEACHERS,
            group="change",
            kind="teacher_link_added",
            key=f"offering:{offering.pk}|teacher:{email}",
            target_id=str(offering.pk),
            before={"links": []},
            after={"teacher_email": email, "role": "LECTURE_INSTRUCTOR"},
            requires=[{"kind": "teacher_created", "key": email}],
        )

    return build


@pytest.fixture
def make_catalog_change(sync_change_factory, catalog_run):
    def build(kind, key, *, after=None, before=None):
        registry = KIND_BY_NAME[kind]
        return sync_change_factory(
            run=catalog_run,
            source=registry.source,
            group=registry.group,
            kind=kind,
            key=key,
            ukma_data_id=key,
            after=after or {},
            before=before or {},
            waiting_on=[],
        )

    return build


def _approve(run, user, source, filters, *, dry_run=False):
    ids = selection.filter_ids(run, source, filters)
    return decisions.approve(
        ids, user, dry_run=dry_run, excluded=selection.excluded_ids(filters), group="change"
    )


@pytest.mark.django_db
@pytest.mark.integration
def test_approve_holds_an_offering_unit_when_a_sibling_link_is_excluded(
    admin, teacher_run, course_offering_factory, make_teacher, make_link
):
    offering = course_offering_factory()
    first_teacher = make_teacher("first@example.com")
    second_teacher = make_teacher("second@example.com")
    first = make_link(offering, "first@example.com")
    second = make_link(offering, "second@example.com")

    result = _approve(
        teacher_run, admin, "teachers", {"group": "change", "exclude_ids": [second.pk]}
    )

    assert result.counts["applied"] == 0
    assert result.counts["waiting"] == len(result.in_state("proposed"))
    for change in (first, second, first_teacher, second_teacher):
        change.refresh_from_db()
        assert change.state == SyncChangeState.PROPOSED
    assert first.waiting_on == [second.pk]


@pytest.mark.django_db
@pytest.mark.integration
def test_approve_holds_a_link_whose_required_teacher_is_excluded(
    admin, teacher_run, course_offering_factory, make_teacher, make_link
):
    offering = course_offering_factory()
    teacher = make_teacher("only@example.com")
    link = make_link(offering, "only@example.com")

    result = _approve(
        teacher_run, admin, "teachers", {"group": "change", "exclude_ids": [teacher.pk]}
    )

    assert result.counts["applied"] == 0
    assert result.counts["waiting"] == 1
    teacher.refresh_from_db()
    link.refresh_from_db()
    assert teacher.state == SyncChangeState.PROPOSED
    assert link.state == SyncChangeState.PROPOSED
    assert link.waiting_on == [teacher.pk]


@pytest.mark.django_db
@pytest.mark.integration
def test_approve_applies_the_whole_unit_when_nothing_in_it_is_excluded(
    admin, teacher_run, course_offering_factory, make_teacher, make_link
):
    offering = course_offering_factory()
    make_teacher("kept@example.com")
    unrelated = make_teacher("unrelated@example.com")
    link = make_link(offering, "kept@example.com")

    result = _approve(
        teacher_run, admin, "teachers", {"group": "change", "exclude_ids": [unrelated.pk]}
    )

    assert result.counts["applied"] == 2
    assert result.approval_id is not None
    link.refresh_from_db()
    unrelated.refresh_from_db()
    assert link.state == SyncChangeState.APPLIED
    assert unrelated.state == SyncChangeState.PROPOSED


@pytest.mark.django_db
@pytest.mark.integration
def test_approve_dry_run_reports_each_change_and_rolls_back(
    admin, teacher_run, course_offering_factory, make_teacher, make_link
):
    offering = course_offering_factory()
    teacher = make_teacher("kept@example.com")
    link = make_link(offering, "kept@example.com")

    result = _approve(teacher_run, admin, "teachers", {"group": "change"}, dry_run=True)

    assert result.approval_id is None
    assert {item.change.pk for item in result.in_state("applied")} == {teacher.pk, link.pk}
    assert not SyncApproval.objects.exists()
    link.refresh_from_db()
    assert link.state == SyncChangeState.PROPOSED


@pytest.mark.django_db
@pytest.mark.integration
def test_reject_dry_run_rolls_back(
    admin, teacher_run, course_offering_factory, make_teacher, make_link
):
    offering = course_offering_factory()
    make_teacher("kept@example.com")
    link = make_link(offering, "kept@example.com")

    result = decisions.reject([link.pk], admin, dry_run=True)

    assert link.pk in {item.change.pk for item in result.in_state("rejected")}
    link.refresh_from_db()
    assert link.state == SyncChangeState.PROPOSED
    assert not SyncApproval.objects.exists()


@pytest.mark.django_db
@pytest.mark.integration
def test_filter_ids_takes_the_other_group(catalog_run, quiet_catalog, make_catalog_change):
    relink = make_catalog_change("relink_course", "course-relink")
    make_catalog_change("place_offering", "off-place")

    ids = selection.filter_ids(catalog_run, "catalog", {"group": "other"})

    assert ids == [relink.pk]


@pytest.mark.django_db
@pytest.mark.integration
def test_current_run_is_the_newest_succeeded_run(sync_run_factory, catalog_run):
    sync_run_factory(source=SyncSource.CATALOG, status=SyncRunStatus.FAILED)

    assert decisions.current_run(SyncSource.CATALOG) == catalog_run
    assert decisions.current_run(SyncSource.TEACHERS) is None


@pytest.mark.django_db
@pytest.mark.integration
def test_refusal_text_names_the_flag_for_a_stale_run(catalog_run):
    assert "--confirm-stale" in decisions.refusal_text("run_too_old", catalog_run)


@pytest.mark.django_db
@pytest.mark.integration
def test_moved_counts_leave_out_a_merge_applied_earlier(
    admin, catalog_run, sync_change_factory, sync_approval_factory, course_factory, monkeypatch
):
    earlier = sync_approval_factory(run=catalog_run, user=admin, change_ids=[])
    merged = sync_change_factory(
        run=catalog_run,
        source=SyncSource.CATALOG,
        group="mapping",
        kind="merge_courses",
        key="ud-course-test-merged",
        state=SyncChangeState.APPLIED,
        approval=earlier,
        decided_at=timezone.now(),
        after={"merge_source": None, "courses": []},
    )
    course = course_factory(title="Тестова дисципліна А")
    fresh = sync_change_factory(
        run=catalog_run,
        source=SyncSource.CATALOG,
        group="change",
        kind="change_course",
        key=str(course.pk),
        target_id=str(course.pk),
        before={"title": "Тестова дисципліна А"},
        after={"title": "Тестова дисципліна Б"},
    )
    counted: list[list[int]] = []

    def moved_counts(changes):
        counted.append([change.pk for change in changes])
        return 0, 0

    monkeypatch.setattr(decisions.review, "moved_counts", moved_counts)

    result = decisions.approve([merged.pk, fresh.pk], admin, dry_run=True, group="change")

    assert [item.change.pk for item in result.decided("applied")] == [fresh.pk]
    assert counted == [[]]


@pytest.mark.django_db
@pytest.mark.integration
def test_approve_caps_the_selection_and_reports_what_remains(
    admin, catalog_run, course_factory, sync_change_factory
):
    changes = []
    for _ in range(3):
        course = course_factory(title="Тестова дисципліна А")
        changes.append(
            sync_change_factory(
                run=catalog_run,
                source="catalog",
                group="change",
                kind="change_course",
                key=str(course.pk),
                target_id=str(course.pk),
                before={"title": "Тестова дисципліна А"},
                after={"title": "Тестова дисципліна Б"},
            )
        )

    result = decisions.approve(
        [change.pk for change in changes], admin, dry_run=False, max_changes=2, group="change"
    )

    assert result.counts["applied"] == 2
    assert result.remaining == 1
    for change in changes[:2]:
        change.refresh_from_db()
        assert change.state == SyncChangeState.APPLIED
    changes[2].refresh_from_db()
    assert changes[2].state == SyncChangeState.PROPOSED


@pytest.mark.django_db
@pytest.mark.integration
def test_approve_rolls_everything_back_past_its_deadline(
    admin, catalog_run, course_factory, sync_change_factory, monkeypatch
):
    course = course_factory(title="Тестова дисципліна А")
    change = sync_change_factory(
        run=catalog_run,
        source="catalog",
        group="change",
        kind="change_course",
        key=str(course.pk),
        target_id=str(course.pk),
        before={"title": "Тестова дисципліна А"},
        after={"title": "Тестова дисципліна Б"},
    )
    ticks = iter([0.0, 100.0])
    monkeypatch.setattr(apply, "monotonic", lambda: next(ticks))

    result = decisions.approve([change.pk], admin, dry_run=False, deadline_seconds=40)

    assert result.outcome == "refused"
    assert result.error == "deadline_exceeded"
    assert result.counts["deadline_seconds"] == 40
    course.refresh_from_db()
    change.refresh_from_db()
    assert course.title == "Тестова дисципліна А"
    assert change.state == SyncChangeState.PROPOSED
    approval = SyncApproval.objects.get()
    assert approval.outcome == SyncApprovalOutcome.REFUSED


@pytest.mark.django_db
@pytest.mark.integration
def test_approve_returns_the_first_result_for_a_repeated_client_key(
    admin, catalog_run, course_factory, sync_change_factory
):
    key = uuid.uuid4()
    course = course_factory(title="Тестова дисципліна А")
    change = sync_change_factory(
        run=catalog_run,
        source="catalog",
        group="change",
        kind="change_course",
        key=str(course.pk),
        target_id=str(course.pk),
        before={"title": "Тестова дисципліна А"},
        after={"title": "Тестова дисципліна Б"},
    )

    first = decisions.approve([change.pk], admin, dry_run=False, client_key=key)
    second = decisions.approve([change.pk], admin, dry_run=False, client_key=key)

    assert first.approval_id is not None
    assert second.approval_id == first.approval_id
    assert second.counts == first.counts
    assert SyncApproval.objects.count() == 1
    course.refresh_from_db()
    assert course.title == "Тестова дисципліна Б"


@pytest.mark.django_db
@pytest.mark.integration
def test_preview_token_refuses_a_changed_selection(
    admin, catalog_run, course_factory, sync_change_factory
):
    def build():
        course = course_factory(title="Тестова дисципліна А")
        return sync_change_factory(
            run=catalog_run,
            source="catalog",
            group="change",
            kind="change_course",
            key=str(course.pk),
            target_id=str(course.pk),
            before={"title": "Тестова дисципліна А"},
            after={"title": "Тестова дисципліна Б"},
        )

    first, second = build(), build()
    preview = decisions.preview([first.pk, second.pk], admin, group="change")

    assert preview.token
    assert SyncPreview.objects.get(token=preview.token).count == 2

    refused = decisions.approve(
        [first.pk], admin, dry_run=False, group="change", preview_token=preview.token
    )

    assert refused.outcome == "refused"
    assert refused.error == "selection_changed"
    first.refresh_from_db()
    assert first.state == SyncChangeState.PROPOSED

    applied = decisions.approve(
        [first.pk, second.pk], admin, dry_run=False, group="change", preview_token=preview.token
    )

    assert applied.outcome == "applied"
    first.refresh_from_db()
    second.refresh_from_db()
    assert first.state == SyncChangeState.APPLIED
    assert second.state == SyncChangeState.APPLIED


@pytest.mark.django_db
@pytest.mark.integration
def test_preview_rejects_an_unknown_token(admin, catalog_run, sync_change_factory):
    change = sync_change_factory(run=catalog_run)

    with pytest.raises(apply.SyncApplyInputError, match="unknown preview token"):
        decisions.approve([change.pk], admin, dry_run=True, preview_token="missing")
