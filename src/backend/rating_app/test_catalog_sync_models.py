import importlib
from pathlib import Path

from django.apps import apps as django_apps
from django.db import IntegrityError, connection, transaction
from django.db.models import Q

import pytest
from waffle.models import Switch

import rating_app.migrations as migrations_package
from rating_app.application_schemas.catalog_sync import PAYLOADS
from rating_app.models import CatalogMappingDecision, CatalogProposal
from rating_app.models.catalog_sync import KIND_GROUP, ListStatus, ProposalGroup, ProposalKind

POSTGRES_ONLY = pytest.mark.skipif(
    connection.vendor != "postgresql",
    reason="NULLS NOT DISTINCT is only created on PostgreSQL",
)


@pytest.mark.django_db
@pytest.mark.integration
def test_catalog_proposal_list_allows_one_ready_list(catalog_proposal_list_factory):
    catalog_proposal_list_factory(status=ListStatus.READY)

    with pytest.raises(IntegrityError), transaction.atomic():
        catalog_proposal_list_factory(status=ListStatus.READY)


@pytest.mark.django_db
@pytest.mark.integration
def test_catalog_proposal_list_allows_several_unbuilt_lists(catalog_proposal_list_factory):
    first = catalog_proposal_list_factory(status=ListStatus.BUILDING)
    second = catalog_proposal_list_factory(status=ListStatus.BUILDING)

    assert first.pk != second.pk


@pytest.mark.django_db
@pytest.mark.integration
@POSTGRES_ONLY
def test_catalog_proposal_rejects_duplicate_when_target_id_is_null(
    catalog_proposal_factory, catalog_proposal_list_factory
):
    proposal_list = catalog_proposal_list_factory()
    catalog_proposal_factory(list=proposal_list, ukma_data_id="ud_1", target_id=None)

    with pytest.raises(IntegrityError), transaction.atomic():
        catalog_proposal_factory(list=proposal_list, ukma_data_id="ud_1", target_id=None)


@pytest.mark.django_db
@pytest.mark.integration
@POSTGRES_ONLY
def test_catalog_mapping_decision_is_unique_only_among_live_rows(
    catalog_mapping_decision_factory,
):
    first = catalog_mapping_decision_factory()
    duplicate = {
        "kind": first.kind,
        "ukma_course_id": first.ukma_course_id,
        "course": first.course,
    }

    with pytest.raises(IntegrityError), transaction.atomic():
        catalog_mapping_decision_factory(**duplicate)

    first.superseded_at = first.decided_at
    first.save(update_fields=["superseded_at"])
    second = catalog_mapping_decision_factory(**duplicate)

    assert second.pk != first.pk


def test_catalog_sync_constraints_keep_nulls_not_distinct():
    proposal = next(
        constraint
        for constraint in CatalogProposal._meta.constraints
        if constraint.name == "catalog_proposal_unique"
    )
    decision = next(
        constraint
        for constraint in CatalogMappingDecision._meta.constraints
        if constraint.name == "catalog_decision_unique"
    )

    assert proposal.nulls_distinct is False
    assert decision.nulls_distinct is False
    assert decision.condition == Q(superseded_at__isnull=True)


def test_every_proposal_kind_has_a_group_and_a_payload():
    assert set(KIND_GROUP) == set(ProposalKind.values)
    assert set(KIND_GROUP.values()) == set(ProposalGroup.values)
    assert set(PAYLOADS) == set(ProposalKind.values)


@pytest.mark.django_db
@pytest.mark.integration
def test_catalog_sync_switch_is_created_inactive_by_data_migration():
    Switch.objects.filter(name="catalog_sync_proposals").delete()
    path = next(Path(migrations_package.__file__).parent.glob("*_catalog_sync_switch.py"))
    migration = importlib.import_module(f"rating_app.migrations.{path.stem}")

    migration.create_switch(django_apps, None)

    switch = Switch.objects.get(name="catalog_sync_proposals")
    assert switch.active is False

    migration.delete_switch(django_apps, None)
    assert not Switch.objects.filter(name="catalog_sync_proposals").exists()
