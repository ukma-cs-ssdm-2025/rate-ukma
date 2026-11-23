from __future__ import annotations

from contextlib import contextmanager

from django.utils import timezone

import pytest

from rating_app.models import (
    CatalogMappingDecision,
    Course,
    CourseOffering,
    Department,
    Faculty,
    SyncApproval,
    SyncApprovalAction,
    SyncApprovalOutcome,
    SyncChangeState,
    SyncPolicyMode,
)
from rating_app.sync import apply, decisions
from rating_app.sync import revert as revert_service
from rating_app.sync.kinds import KIND_BY_NAME

REVERT = SyncApprovalAction.REVERT
APPLIED = SyncApprovalOutcome.APPLIED


@contextmanager
def _lock_free(_key: int):
    yield True


@pytest.fixture(autouse=True)
def free_locks(monkeypatch):
    monkeypatch.setattr(apply, "advisory_lock", _lock_free)
    monkeypatch.setattr(revert_service, "advisory_lock", _lock_free)


@pytest.fixture
def catalog_run(sync_run_factory):
    return sync_run_factory(source="catalog", status="succeeded", finished_at=timezone.now())


@pytest.fixture
def applied_approval(sync_approval_factory, catalog_run, user):
    return sync_approval_factory(
        run=catalog_run,
        user=user,
        action=SyncApprovalAction.APPLY,
        outcome=APPLIED,
        change_ids=[],
        counts={"plans_deduplicated_by_move": 0},
    )


@pytest.fixture
def make_applied(sync_change_factory, applied_approval):
    def build(kind, key, *, target_id=None, before=None, after=None, **kwargs):
        registry = KIND_BY_NAME[kind]
        return sync_change_factory(
            run=applied_approval.run,
            source=registry.source,
            group=registry.group,
            kind=kind,
            key=key,
            target_id=target_id,
            ukma_data_id=key,
            before=before or {},
            after=after or {},
            state=SyncChangeState.APPLIED,
            approval=applied_approval,
            decided_at=timezone.now(),
            **kwargs,
        )

    return build


@pytest.mark.django_db
@pytest.mark.integration
@pytest.mark.parametrize(
    ("kind", "factory_name"),
    [
        ("link_faculty", "faculty_factory"),
        ("link_department", "department_factory"),
        ("link_course", "course_factory"),
        ("link_offering", "course_offering_factory"),
    ],
)
def test_revert_restores_a_link_and_keeps_the_original_approval(
    kind, factory_name, request, make_applied, applied_approval, user
):
    row = request.getfixturevalue(factory_name)()
    model = {"link_faculty": Faculty, "link_department": Department, "link_course": Course}.get(
        kind, CourseOffering
    )
    model.objects.filter(pk=row.pk).update(ukma_data_id="ud-new")
    change = make_applied(
        kind,
        str(row.pk),
        target_id=str(row.pk),
        before={"ukma_data_id": None},
        after={"ukma_data_id": "ud-new"},
    )

    result = decisions.revert(applied_approval.pk, user, dry_run=False)

    assert result.outcome == APPLIED
    assert result.counts["reverted"] == 1
    assert model.objects.get(pk=row.pk).ukma_data_id is None
    change.refresh_from_db()
    assert change.state == SyncChangeState.REVERTED
    assert change.approval_id == applied_approval.pk
    revert_approval = SyncApproval.objects.get(pk=result.approval_id)
    assert revert_approval.action == REVERT
    assert revert_approval.reverts_id == applied_approval.pk


@pytest.mark.django_db
@pytest.mark.integration
@pytest.mark.parametrize(
    ("kind", "factory_name"),
    [("change_faculty", "faculty_factory"), ("change_department", "department_factory")],
)
def test_revert_restores_a_name(kind, factory_name, request, make_applied, applied_approval, user):
    row = request.getfixturevalue(factory_name)(name="Тестова назва Б")
    make_applied(
        kind,
        str(row.pk),
        target_id=str(row.pk),
        before={"name": "Тестова назва А"},
        after={"name": "Тестова назва Б"},
    )

    result = decisions.revert(applied_approval.pk, user, dry_run=False)

    assert result.outcome == APPLIED
    row.refresh_from_db()
    assert row.name == "Тестова назва А"


@pytest.mark.django_db
@pytest.mark.integration
def test_revert_restores_a_course_title_and_department(
    make_applied, applied_approval, user, course_factory, department_factory
):
    old_department = department_factory(name="Кафедра тестових даних")
    new_department = department_factory(name="Кафедра інших даних")
    course = course_factory(title="Тестова дисципліна Б", department=new_department)
    before = {
        "title": "Тестова дисципліна А",
        "department": {
            "id": str(old_department.pk),
            "ukma_data_id": None,
            "name": old_department.name,
        },
    }
    make_applied(
        "change_course",
        str(course.pk),
        target_id=str(course.pk),
        before=before,
        after={"title": "Тестова дисципліна Б", "department": {"id": str(new_department.pk)}},
    )

    result = decisions.revert(applied_approval.pk, user, dry_run=False)

    assert result.outcome == APPLIED
    course.refresh_from_db()
    assert course.title == "Тестова дисципліна А"
    assert course.department_id == old_department.pk


@pytest.mark.django_db
@pytest.mark.integration
def test_revert_restores_offering_fields_and_terms(
    make_applied, applied_approval, user, course_offering_factory, semester_factory
):
    offering = course_offering_factory(max_students=45)
    old_semester = semester_factory(year=2024, term="FALL")
    new_semester = semester_factory(year=2025, term="SPRING")
    CourseOffering.objects.filter(pk=offering.pk).update(semester_id=new_semester.pk)
    before = {
        "max_students": 60,
        "semester": {"year": old_semester.year, "term": old_semester.term},
        "terms": [
            {
                "year": 2024,
                "term": "FALL",
                "credits": "3.0",
                "weekly_hours": 2,
                "lecture_count": 10,
                "practice_count": 5,
                "practice_type": "PRACTICE",
                "exam_type": "EXAM",
            }
        ],
    }
    make_applied(
        "change_offering",
        str(offering.pk),
        target_id=str(offering.pk),
        before=before,
        after={"max_students": 45, "semester": {"year": 2025, "term": "SPRING"}},
    )

    result = decisions.revert(applied_approval.pk, user, dry_run=False)

    assert result.outcome == APPLIED
    offering.refresh_from_db()
    assert offering.max_students == 60
    assert offering.semester_id == old_semester.pk
    terms = list(offering.terms.values_list("semester__year", "credits"))
    assert terms == [(2024, 3)]


@pytest.mark.django_db
@pytest.mark.integration
def test_revert_moves_an_offering_back(
    make_applied, applied_approval, user, course_factory, course_offering_factory
):
    source = course_factory(title="Тестова дисципліна А")
    target = course_factory(title="Тестова дисципліна Б")
    offering = course_offering_factory(course=target)
    make_applied(
        "move_offering",
        str(offering.pk),
        target_id=str(offering.pk),
        before={"from_course": str(source.pk)},
        after={"from_course": str(source.pk), "to_course_id": str(target.pk)},
    )

    result = decisions.revert(applied_approval.pk, user, dry_run=False)

    assert result.outcome == APPLIED
    offering.refresh_from_db()
    assert offering.course_id == source.pk


@pytest.mark.django_db
@pytest.mark.integration
def test_revert_of_only_removed_changes_has_nothing_to_do(
    make_applied, applied_approval, user, course_factory
):
    course = course_factory()
    make_applied("removed_course", str(course.pk), target_id=str(course.pk))

    result = decisions.revert(applied_approval.pk, user, dry_run=False)

    assert result.error == "nothing_to_revert"
    assert SyncApproval.objects.filter(action=REVERT, outcome=SyncApprovalOutcome.REFUSED).exists()


@pytest.mark.django_db
@pytest.mark.integration
@pytest.mark.parametrize(
    ("kind", "expected"),
    [
        ("new_course", "нові записи"),
        ("merge_courses", "резервної копії"),
        ("place_offering", "резервної копії"),
        ("teacher_link_added", "викладачів"),
    ],
)
def test_revert_refuses_kinds_that_need_a_person(
    kind, expected, make_applied, applied_approval, user, course_factory
):
    course = course_factory()
    make_applied(kind, str(course.pk), target_id=str(course.pk))

    result = decisions.revert(applied_approval.pk, user, dry_run=False)

    assert result.outcome == SyncApprovalOutcome.REFUSED
    assert result.error == "revert_blocked"
    assert expected in result.blockers[0].text


@pytest.mark.django_db
@pytest.mark.integration
def test_revert_lists_a_changed_record_as_a_blocker(
    make_applied, applied_approval, user, course_factory
):
    course = course_factory()
    Course.objects.filter(pk=course.pk).update(ukma_data_id="ud-other")
    make_applied(
        "link_course",
        str(course.pk),
        target_id=str(course.pk),
        before={"ukma_data_id": None},
        after={"ukma_data_id": "ud-new"},
    )

    result = decisions.revert(applied_approval.pk, user, dry_run=True)

    assert result.error == "revert_blocked"
    assert result.blockers[0].reason == "changed"
    assert "запис змінився після застосування" in result.blockers[0].text
    assert Course.objects.get(pk=course.pk).ukma_data_id == "ud-other"


@pytest.mark.django_db
@pytest.mark.integration
def test_revert_lists_a_later_decision_touching_the_same_record_as_a_blocker(
    make_applied,
    applied_approval,
    user,
    course_factory,
    sync_approval_factory,
    sync_change_factory,
):
    course = course_factory()
    Course.objects.filter(pk=course.pk).update(ukma_data_id="ud-new")
    make_applied(
        "link_course",
        str(course.pk),
        target_id=str(course.pk),
        before={"ukma_data_id": None},
        after={"ukma_data_id": "ud-new"},
    )
    later = sync_approval_factory(
        run=applied_approval.run,
        user=user,
        action=SyncApprovalAction.APPLY,
        outcome=APPLIED,
    )
    sync_change_factory(
        run=applied_approval.run,
        kind="link_offering",
        key="later",
        target_id=str(course.pk),
        state=SyncChangeState.APPLIED,
        approval=later,
        decided_at=timezone.now(),
    )

    result = decisions.revert(applied_approval.pk, user, dry_run=True)

    assert result.error == "revert_blocked"
    assert result.blockers[0].reason == "later"
    assert f"рішення #{later.pk}" in result.blockers[0].text


@pytest.mark.django_db
@pytest.mark.integration
def test_revert_ignores_a_later_decision_that_was_reverted_itself(
    make_applied,
    applied_approval,
    user,
    course_factory,
    sync_approval_factory,
    sync_change_factory,
):
    course = course_factory()
    Course.objects.filter(pk=course.pk).update(ukma_data_id="ud-new")
    make_applied(
        "link_course",
        str(course.pk),
        target_id=str(course.pk),
        before={"ukma_data_id": None},
        after={"ukma_data_id": "ud-new"},
    )
    later = sync_approval_factory(
        run=applied_approval.run,
        user=user,
        action=SyncApprovalAction.APPLY,
        outcome=APPLIED,
    )
    sync_change_factory(
        run=applied_approval.run,
        kind="link_offering",
        key="later",
        target_id=str(course.pk),
        state=SyncChangeState.APPLIED,
        approval=later,
        decided_at=timezone.now(),
    )
    sync_approval_factory(
        run=applied_approval.run,
        user=user,
        action=REVERT,
        outcome=APPLIED,
        reverts=later,
    )

    result = decisions.revert(applied_approval.pk, user, dry_run=False)

    assert result.outcome == APPLIED
    assert Course.objects.get(pk=course.pk).ukma_data_id is None


@pytest.mark.django_db
@pytest.mark.integration
def test_revert_lists_a_later_change_requiring_one_of_ours(
    make_applied,
    applied_approval,
    user,
    course_factory,
    sync_approval_factory,
    sync_change_factory,
):
    course = course_factory()
    Course.objects.filter(pk=course.pk).update(ukma_data_id="ud-new")
    change = make_applied(
        "link_course",
        str(course.pk),
        target_id=str(course.pk),
        before={"ukma_data_id": None},
        after={"ukma_data_id": "ud-new"},
    )
    later = sync_approval_factory(
        run=applied_approval.run,
        user=user,
        action=SyncApprovalAction.APPLY,
        outcome=APPLIED,
    )
    sync_change_factory(
        run=applied_approval.run,
        kind="new_offering",
        key="later-offering",
        state=SyncChangeState.APPLIED,
        approval=later,
        decided_at=timezone.now(),
        requires=[{"kind": "link_course", "key": change.key}],
    )

    result = decisions.revert(applied_approval.pk, user, dry_run=True)

    assert result.blockers[0].reason == "later"


@pytest.mark.django_db
@pytest.mark.integration
def test_revert_lists_an_auto_kind_as_a_blocker(
    make_applied, applied_approval, user, course_factory, sync_policy_factory
):
    course = course_factory()
    Course.objects.filter(pk=course.pk).update(ukma_data_id="ud-new")
    make_applied(
        "link_course",
        str(course.pk),
        target_id=str(course.pk),
        before={"ukma_data_id": None},
        after={"ukma_data_id": "ud-new"},
    )
    sync_policy_factory(kind="link_course", mode=SyncPolicyMode.AUTO, updated_by=user)

    result = decisions.revert(applied_approval.pk, user, dry_run=True)

    assert result.blockers[0].reason == "auto"
    assert "автоматично" in result.blockers[0].text


@pytest.mark.django_db
@pytest.mark.integration
def test_revert_blocks_a_move_applied_before_its_plans_were_counted(
    make_applied, applied_approval, user, course_factory, course_offering_factory
):
    applied_approval.counts = {"applied": 1}
    applied_approval.save(update_fields=["counts"])
    source = course_factory(title="Тестова дисципліна А")
    target = course_factory(title="Тестова дисципліна Б")
    offering = course_offering_factory(course=target)
    make_applied(
        "move_offering",
        str(offering.pk),
        target_id=str(offering.pk),
        before={"from_course": str(source.pk)},
        after={"from_course": str(source.pk), "to_course_id": str(target.pk)},
    )

    result = decisions.revert(applied_approval.pk, user, dry_run=True)

    assert [blocker.reason for blocker in result.blockers] == ["plans"]


@pytest.mark.django_db
@pytest.mark.integration
def test_revert_dry_run_fails_like_the_real_one_when_the_old_course_is_gone(
    make_applied, applied_approval, user, course_factory, course_offering_factory
):
    source = course_factory(title="Тестова дисципліна А")
    target = course_factory(title="Тестова дисципліна Б")
    offering = course_offering_factory(course=target)
    make_applied(
        "move_offering",
        str(offering.pk),
        target_id=str(offering.pk),
        before={"from_course": str(source.pk)},
        after={"from_course": str(source.pk), "to_course_id": str(target.pk)},
    )
    source.delete()

    dry = decisions.revert(applied_approval.pk, user, dry_run=True)
    real = decisions.revert(applied_approval.pk, user, dry_run=False)

    assert dry.outcome == real.outcome == "failed"
    offering.refresh_from_db()
    assert offering.course_id == target.pk


@pytest.mark.django_db
@pytest.mark.integration
def test_revert_lists_a_move_that_merged_plans_as_a_blocker(
    make_applied,
    applied_approval,
    user,
    course_factory,
    course_offering_factory,
    sync_approval_factory,
):
    applied_approval.counts = {"plans_deduplicated_by_move": 2}
    applied_approval.save(update_fields=["counts"])
    source = course_factory(title="Тестова дисципліна А")
    target = course_factory(title="Тестова дисципліна Б")
    offering = course_offering_factory(course=target)
    make_applied(
        "move_offering",
        str(offering.pk),
        target_id=str(offering.pk),
        before={"from_course": str(source.pk)},
        after={"from_course": str(source.pk), "to_course_id": str(target.pk)},
    )

    result = decisions.revert(applied_approval.pk, user, dry_run=True)

    assert result.blockers[0].reason == "plans"
    assert "об'єднано плани" in result.blockers[0].text


@pytest.mark.django_db
@pytest.mark.integration
def test_revert_is_all_or_nothing(make_applied, applied_approval, user, course_factory):
    course = course_factory()
    Course.objects.filter(pk=course.pk).update(ukma_data_id="ud-new")
    link = make_applied(
        "link_course",
        str(course.pk),
        target_id=str(course.pk),
        before={"ukma_data_id": None},
        after={"ukma_data_id": "ud-new"},
    )
    make_applied("new_course", "ud-new-course")

    result = decisions.revert(applied_approval.pk, user, dry_run=False)

    assert result.outcome == SyncApprovalOutcome.REFUSED
    link.refresh_from_db()
    assert link.state == SyncChangeState.APPLIED
    assert Course.objects.get(pk=course.pk).ukma_data_id == "ud-new"
    assert not SyncApproval.objects.filter(action=REVERT, outcome=APPLIED).exists()


@pytest.mark.django_db
@pytest.mark.integration
def test_revert_dry_run_writes_nothing(make_applied, applied_approval, user, course_factory):
    course = course_factory()
    Course.objects.filter(pk=course.pk).update(ukma_data_id="ud-new")
    change = make_applied(
        "link_course",
        str(course.pk),
        target_id=str(course.pk),
        before={"ukma_data_id": None},
        after={"ukma_data_id": "ud-new"},
    )
    before_count = SyncApproval.objects.count()

    result = decisions.revert(applied_approval.pk, user, dry_run=True)

    assert result.approval_id is None
    assert SyncApproval.objects.count() == before_count
    change.refresh_from_db()
    assert change.state == SyncChangeState.APPLIED
    assert Course.objects.get(pk=course.pk).ukma_data_id == "ud-new"


@pytest.mark.django_db
@pytest.mark.integration
@pytest.mark.parametrize("kind", ["relink_course", "move_offering"])
def test_revert_supersedes_the_live_mapping_answer(
    kind,
    make_applied,
    applied_approval,
    user,
    course_factory,
    course_offering_factory,
    catalog_mapping_decision_factory,
):
    course = course_factory()
    if kind == "relink_course":
        Course.objects.filter(pk=course.pk).update(ukma_data_id="ud-new")
        target_id = str(course.pk)
        before = {"ukma_data_id": "ud-old"}
        after = {"ukma_data_id": "ud-new"}
    else:
        other = course_factory(title="Тестова дисципліна Б")
        offering = course_offering_factory(course=other)
        target_id = str(offering.pk)
        before = {"from_course": str(course.pk)}
        after = {"from_course": str(course.pk), "to_course_id": str(other.pk)}
    change = make_applied(kind, target_id, target_id=target_id, before=before, after=after)
    decision = catalog_mapping_decision_factory(
        kind=kind,
        question_key=change.key,
        ukma_course_id="ud-question",
        course=course if kind == "relink_course" else None,
    )

    result = decisions.revert(applied_approval.pk, user, dry_run=False)

    assert result.outcome == APPLIED
    if kind == "relink_course":
        assert Course.objects.get(pk=course.pk).ukma_data_id == "ud-old"
    else:
        assert CourseOffering.objects.get(pk=target_id).course_id == course.pk
    decision.refresh_from_db()
    assert decision.superseded_at is not None
    assert CatalogMappingDecision.objects.filter(superseded_at__isnull=True).count() == 0


@pytest.mark.django_db
@pytest.mark.integration
def test_revert_reports_an_unknown_decision(applied_approval, user):
    result = decisions.revert(999_999, user, dry_run=True)

    assert result.error == "unknown_approval"
    assert result.refusal_text() == "Рішення не знайдено."


@pytest.mark.django_db
@pytest.mark.integration
def test_revert_refuses_a_rejection(sync_approval_factory, catalog_run, user):
    rejection = sync_approval_factory(
        run=catalog_run,
        user=user,
        action=SyncApprovalAction.REJECT,
        outcome=APPLIED,
    )

    result = decisions.revert(rejection.pk, user, dry_run=True)

    assert result.error == "not_an_apply"


@pytest.mark.django_db
@pytest.mark.integration
def test_a_revert_that_fails_midway_writes_nothing(
    make_applied, applied_approval, user, course_factory, monkeypatch
):
    linked = course_factory(title="Тестова дисципліна А")
    Course.objects.filter(pk=linked.pk).update(ukma_data_id="ud-new")
    link = make_applied(
        "link_course",
        str(linked.pk),
        target_id=str(linked.pk),
        before={"ukma_data_id": None},
        after={"ukma_data_id": "ud-new"},
    )
    renamed = course_factory(title="Тестова дисципліна Б")
    title = make_applied(
        "change_course",
        str(renamed.pk),
        target_id=str(renamed.pk),
        before={"title": "Тестова дисципліна А"},
        after={"title": "Тестова дисципліна Б"},
    )

    def explode(*_args, **_kwargs):
        raise RuntimeError("test")

    monkeypatch.setattr(revert_service, "_restore_course", explode)

    result = decisions.revert(applied_approval.pk, user, dry_run=False)

    assert result.outcome == SyncApprovalOutcome.FAILED
    assert result.error == "revert_failed"
    assert Course.objects.get(pk=linked.pk).ukma_data_id == "ud-new"
    assert Course.objects.get(pk=renamed.pk).title == "Тестова дисципліна Б"
    for change in (link, title):
        change.refresh_from_db()
        assert change.state == SyncChangeState.APPLIED
