from django.db import IntegrityError, connection, transaction

import pytest

from rating_app.models import CatalogMappingDecision, SyncPolicy, SyncPolicyMode
from rating_app.sync.kinds import NEVER_AUTO_KINDS

POSTGRES_ONLY = pytest.mark.skipif(
    connection.vendor != "postgresql",
    reason="NULLS NOT DISTINCT is only created on PostgreSQL",
)

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
def test_mapping_decision_partial_unique_constraint_keeps_nulls_not_distinct():
    constraint = next(
        constraint
        for constraint in CatalogMappingDecision._meta.constraints
        if constraint.name == "sync_decision_live_unique"
    )

    assert constraint.nulls_distinct is False


@pytest.mark.django_db
@pytest.mark.integration
@POSTGRES_ONLY
def test_mapping_decision_is_unique_only_among_live_rows(catalog_mapping_decision_factory):
    first = catalog_mapping_decision_factory()
    duplicate = {
        "kind": first.kind,
        "ukma_course_id": first.ukma_course_id,
        "course": first.course,
        "offering": None,
    }

    with pytest.raises(IntegrityError), transaction.atomic():
        catalog_mapping_decision_factory(**duplicate)

    first.superseded_at = first.decided_at
    first.save(update_fields=["superseded_at"])
    second = catalog_mapping_decision_factory(**duplicate)

    assert second.pk != first.pk
