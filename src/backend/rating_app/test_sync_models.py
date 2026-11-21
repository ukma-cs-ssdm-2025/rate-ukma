from django.db import IntegrityError, transaction

import pytest

from rating_app.models import SyncPolicy, SyncPolicyMode
from rating_app.sync.kinds import NEVER_AUTO_KINDS

NEVER_AUTO_MUST_INCLUDE = {
    "merge_courses",
    "move_offering",
    "place_offering",
    "relink_course",
}


def _never_auto_constraint():
    return next(
        constraint
        for constraint in SyncPolicy._meta.constraints
        if constraint.name == "sync_policy_never_auto"
    )


def test_never_auto_kinds_are_sorted_and_cover_the_mapping_kinds():
    assert NEVER_AUTO_KINDS == tuple(sorted(NEVER_AUTO_KINDS))
    assert NEVER_AUTO_MUST_INCLUDE <= set(NEVER_AUTO_KINDS)


def test_policy_constraint_lists_exactly_the_never_auto_kinds():
    condition = _never_auto_constraint().condition

    assert condition.negated is True
    assert set(dict(condition.children)["kind__in"]) == set(NEVER_AUTO_KINDS)


@pytest.mark.django_db
@pytest.mark.integration
@pytest.mark.parametrize("kind", NEVER_AUTO_KINDS)
def test_policy_rejects_auto_for_never_auto_kind_in_the_database(kind, user):
    with pytest.raises(IntegrityError), transaction.atomic():
        SyncPolicy.objects.create(kind=kind, mode=SyncPolicyMode.AUTO, updated_by=user)


@pytest.mark.django_db
@pytest.mark.integration
def test_sync_change_key_is_unique_per_run_and_kind(sync_change_factory):
    change = sync_change_factory(kind="link_course", key="offering:1")

    with pytest.raises(IntegrityError), transaction.atomic():
        sync_change_factory(run=change.run, kind="link_course", key="offering:1")

    other_run_change = sync_change_factory(kind="link_course", key="offering:1")

    assert other_run_change.pk != change.pk


@pytest.mark.django_db
@pytest.mark.integration
def test_mapping_decision_is_unique_per_question_only_among_live_rows(
    catalog_mapping_decision_factory,
):
    first = catalog_mapping_decision_factory()
    duplicate = {"kind": first.kind, "question_key": first.question_key}

    with pytest.raises(IntegrityError), transaction.atomic():
        catalog_mapping_decision_factory(**duplicate)

    first.superseded_at = first.decided_at
    first.save(update_fields=["superseded_at"])
    second = catalog_mapping_decision_factory(**duplicate)

    assert second.pk != first.pk


@pytest.mark.django_db
@pytest.mark.integration
def test_two_place_answers_about_one_ukma_data_course_stay_apart(
    catalog_mapping_decision_factory, course_factory
):
    target = course_factory()
    common = {"kind": "place_offering", "ukma_course_id": "ud_course_x", "into": target}

    catalog_mapping_decision_factory(question_key="place:100001", saz_code="100001", **common)
    second = catalog_mapping_decision_factory(
        question_key="place:100002", saz_code="100002", **common
    )

    assert second.pk is not None


@pytest.mark.django_db
@pytest.mark.integration
def test_deleting_a_decided_course_keeps_the_decision_and_its_id(
    catalog_mapping_decision_factory,
):
    decision = catalog_mapping_decision_factory()
    course = decision.course
    course_id = str(course.pk)
    decision.course_ref = course_id
    decision.save(update_fields=["course_ref"])

    course.delete()
    decision.refresh_from_db()

    assert decision.course is None
    assert decision.course_ref == course_id
