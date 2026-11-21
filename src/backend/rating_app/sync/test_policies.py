import pytest

from rating_app.models import SyncPolicy, SyncPolicyChange, SyncPolicyMode
from rating_app.sync.kinds import NEVER_AUTO_KINDS
from rating_app.sync.policies import (
    NeverAutoKindError,
    UnknownSyncKindError,
    mode_for,
    set_mode,
)


@pytest.mark.django_db
@pytest.mark.integration
def test_mode_for_defaults_to_needs_approval_without_a_policy_row():
    assert mode_for("new_offering") == SyncPolicyMode.NEEDS_APPROVAL


@pytest.mark.django_db
@pytest.mark.integration
@pytest.mark.parametrize("kind", NEVER_AUTO_KINDS)
def test_set_mode_refuses_auto_for_every_never_auto_kind(kind, user):
    with pytest.raises(NeverAutoKindError):
        set_mode(kind, SyncPolicyMode.AUTO, user)

    assert not SyncPolicy.objects.filter(kind=kind).exists()


@pytest.mark.django_db
@pytest.mark.integration
def test_set_mode_refuses_an_unknown_kind(user):
    with pytest.raises(UnknownSyncKindError):
        set_mode("catalog_refactored", SyncPolicyMode.AUTO, user)

    assert not SyncPolicy.objects.exists()


@pytest.mark.django_db
@pytest.mark.integration
def test_set_mode_writes_one_audit_row_per_real_change(user):
    set_mode("new_offering", SyncPolicyMode.NEEDS_APPROVAL, user)

    assert not SyncPolicy.objects.exists()
    assert not SyncPolicyChange.objects.exists()

    policy = set_mode("new_offering", SyncPolicyMode.AUTO, user)

    assert policy is not None
    assert policy.mode == SyncPolicyMode.AUTO
    first_change = SyncPolicyChange.objects.get()
    assert first_change.kind == "new_offering"
    assert first_change.old_mode == SyncPolicyMode.NEEDS_APPROVAL
    assert first_change.new_mode == SyncPolicyMode.AUTO
    assert first_change.user == user

    set_mode("new_offering", SyncPolicyMode.AUTO, user)

    assert SyncPolicyChange.objects.count() == 1

    set_mode("new_offering", SyncPolicyMode.NEEDS_APPROVAL, user)

    assert SyncPolicyChange.objects.count() == 2
    assert mode_for("new_offering") == SyncPolicyMode.NEEDS_APPROVAL
