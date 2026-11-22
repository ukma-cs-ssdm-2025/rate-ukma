from __future__ import annotations

from django.contrib.auth.models import User
from django.db import transaction

from rating_app.models.sync import SyncPolicy, SyncPolicyChange, SyncPolicyMode
from rating_app.sync.kinds import KIND_BY_NAME, NEVER_AUTO_KINDS


class UnknownSyncKindError(ValueError):
    """A kind that is not in the sync kind registry."""


class NeverAutoKindError(ValueError):
    """A kind that always needs a person's approval."""


def mode_for(kind: str) -> str:
    """The kind's policy; a missing row means `needs_approval`."""
    mode = SyncPolicy.objects.filter(kind=kind).values_list("mode", flat=True).first()
    return mode or SyncPolicyMode.NEEDS_APPROVAL


def set_mode(kind: str, mode: str, user: User) -> SyncPolicy | None:
    """Write the policy and its audit row together; a no-op writes nothing."""
    registry_kind = KIND_BY_NAME.get(kind)
    if registry_kind is None:
        raise UnknownSyncKindError(f"Unknown sync kind: {kind}")
    if mode not in SyncPolicyMode.values:
        raise ValueError(f"Unknown sync policy mode: {mode}")
    if mode == SyncPolicyMode.AUTO and registry_kind.name in NEVER_AUTO_KINDS:
        raise NeverAutoKindError("Цей вид змін завжди потребує підтвердження")

    with transaction.atomic():
        policy = SyncPolicy.objects.filter(kind=kind).first()
        old_mode = policy.mode if policy is not None else SyncPolicyMode.NEEDS_APPROVAL
        if old_mode == mode:
            return policy

        if policy is None:
            policy = SyncPolicy.objects.create(kind=kind, mode=mode, updated_by=user)
        else:
            policy.mode = mode
            policy.updated_by = user
            policy.save(update_fields=["mode", "updated_by", "updated_at"])

        SyncPolicyChange.objects.create(kind=kind, old_mode=old_mode, new_mode=mode, user=user)
        return policy
