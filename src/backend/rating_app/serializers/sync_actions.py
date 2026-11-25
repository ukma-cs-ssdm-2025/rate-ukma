"""Serializers for the sync actions of /data: preview, apply, reject, revert and
the journal. The request bodies name a selection; the responses fix the shape a
generated client sees."""

from __future__ import annotations

from rest_framework import serializers

from rating_app.models.sync import (
    MappingAnswer,
    SyncApprovalAction,
    SyncApprovalOutcome,
    SyncChangeGroup,
    SyncChangeStateReason,
    SyncPolicyMode,
    SyncSource,
    UkmaDataDecisionAction,
    UkmaDataDecisionOutcome,
)
from rating_app.serializers.sync import SELECTION_GROUP_CHOICES
from rating_app.sync.kinds import KIND_BY_NAME

KIND_CHOICES = [(kind, kind) for kind in KIND_BY_NAME]

JOURNAL_KINDS = [
    ("apply", "Apply"),
    ("reject", "Reject"),
    ("revert", "Revert"),
    ("policy", "Policy"),
    ("answer", "Answer"),
    ("decision", "Decision"),
]

JOURNAL_OUTCOMES = [
    *SyncApprovalOutcome.choices,
    ("changed", "Changed"),
    *MappingAnswer.choices,
    *UkmaDataDecisionOutcome.choices,
]


LEFT_OUT_CODES = [
    *[(str(reason), str(reason)) for reason in SyncChangeStateReason.values],
    ("waiting_on", "Waiting on other changes"),
    ("mapping_unanswered", "Mapping question unanswered"),
    ("not_ready", "Not ready"),
    ("rejected", "Rejected"),
    ("already_applied", "Already applied"),
    ("reverted", "Reverted"),
]

REVERT_BLOCKER_CODES = [
    ("manual", "Manual only"),
    ("auto", "Auto kind"),
    ("plans", "Plans merged by the move"),
    ("later", "A later decision touched the record"),
    ("changed", "The record changed after the apply"),
]

REVERT_REFUSAL_CODES = [
    ("unknown_approval", "Unknown decision"),
    ("not_an_apply", "Not an apply"),
    ("not_applied", "Nothing was applied"),
    ("already_reverted", "Already reverted"),
    ("nothing_to_revert", "Nothing to revert"),
    ("lock_held", "Sync lock held"),
    ("revert_blocked", "Blockers"),
    ("revert_failed", "Revert failed"),
]

REFUSAL_CODES = [
    ("selection_changed", "The selection changed"),
    ("lock_held", "Sync lock held"),
    ("run_not_current", "Run is not current"),
    ("run_too_old", "Run is too old"),
    ("in_progress", "Decision still running"),
    ("deadline_exceeded", "Deadline exceeded"),
    ("no_proposed_changes", "Nothing proposed"),
    ("failed", "Apply failed"),
]


class SyncActionSelectionSerializer(serializers.Serializer):
    """Name exactly one selection: `group` (optionally narrowed by `kind`) or a nonempty
    `change_ids` list. Neither, both, or an empty list answers 400. With `run` pinned,
    every id in `change_ids` must belong to that run."""

    run = serializers.IntegerField(
        required=False, allow_null=True, min_value=1, help_text="Pin one run; omit for the current"
    )
    source = serializers.ChoiceField(choices=SyncSource.choices, default=SyncSource.CATALOG)
    group = serializers.ChoiceField(
        choices=SELECTION_GROUP_CHOICES, required=False, allow_null=True
    )
    kind = serializers.ChoiceField(
        choices=KIND_CHOICES,
        required=False,
        allow_null=True,
        error_messages={"invalid_choice": "Невідомий вид зміни"},
    )
    change_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        required=False,
        allow_empty=False,
        max_length=5000,
        help_text="Explicit changes; an alternative to `group`",
    )
    rated = serializers.BooleanField(
        required=False,
        allow_null=True,
        default=None,
        help_text="With `group`: only rows with ratings (`true`) or without (`false`)",
    )
    match = serializers.ChoiceField(
        choices=[("exact", "Exact"), ("review", "Review")],
        required=False,
        allow_null=True,
        default=None,
        help_text="With `group=link`: exact links or links to check",
    )
    changed_field = serializers.CharField(
        required=False,
        allow_null=True,
        default=None,
        max_length=50,
        help_text="With `group=change`: rows that change this field",
    )
    exclude_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        required=False,
        default=list,
        max_length=5000,
        help_text="With `group`: changes the person left out",
    )

    def validate(self, attrs: dict[str, object]) -> dict[str, object]:
        if (attrs.get("change_ids") is None) == (attrs.get("group") is None):
            raise serializers.ValidationError("Вкажіть або групу, або зміни")
        return attrs


class SyncPreviewRequestSerializer(SyncActionSelectionSerializer):
    pass


class SyncApplyRequestSerializer(SyncActionSelectionSerializer):
    token = serializers.CharField(help_text="The token `preview` returned for this selection")
    client_key = serializers.UUIDField(
        help_text="Idempotency key; a retry with the same key returns the first result. "
        "Each new attempt needs a new key."
    )


class SyncRejectRequestSerializer(SyncActionSelectionSerializer):
    run = serializers.IntegerField(min_value=1, help_text="The run the person looked at")
    client_key = serializers.UUIDField(
        help_text="Idempotency key; a retry with the same key returns the first result. "
        "Each new attempt needs a new key."
    )


class SyncRevertRequestSerializer(serializers.Serializer):
    approval_id = serializers.IntegerField(min_value=1)
    dry_run = serializers.BooleanField(default=True)


class SyncKindCountSerializer(serializers.Serializer):
    kind = serializers.ChoiceField(choices=KIND_CHOICES)
    count = serializers.IntegerField(min_value=0)


class SyncReasonCountSerializer(serializers.Serializer):
    code = serializers.ChoiceField(choices=LEFT_OUT_CODES)
    text = serializers.CharField()
    count = serializers.IntegerField(min_value=0)


class SyncRunAgeSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    source = serializers.ChoiceField(choices=SyncSource.choices)
    finished_at = serializers.DateTimeField(allow_null=True)
    data_updated_at = serializers.DateTimeField(allow_null=True)
    age_hours = serializers.IntegerField(allow_null=True)


class SyncDecisionCountsSerializer(serializers.Serializer):
    applied = serializers.IntegerField(min_value=0)
    rejected = serializers.IntegerField(min_value=0)
    skipped = serializers.IntegerField(min_value=0)
    waiting = serializers.IntegerField(min_value=0)
    superseded = serializers.IntegerField(min_value=0)
    remaining = serializers.IntegerField(
        min_value=0, help_text="Selected changes left for the next request by the 5 000 cap"
    )
    total = serializers.IntegerField(min_value=0)
    by_kind = SyncKindCountSerializer(many=True)


class SyncPreviewResponseSerializer(serializers.Serializer):
    token = serializers.CharField(allow_blank=True)
    detail = serializers.CharField()
    counts = SyncDecisionCountsSerializer()
    skipped_reasons = SyncReasonCountSerializer(many=True)
    waiting_reasons = SyncReasonCountSerializer(many=True)
    run = SyncRunAgeSerializer()


class SyncDecisionResponseSerializer(serializers.Serializer):
    decision_id = serializers.IntegerField(allow_null=True)
    action = serializers.ChoiceField(choices=SyncApprovalAction.choices)
    outcome = serializers.ChoiceField(choices=SyncApprovalOutcome.choices)
    detail = serializers.CharField()
    counts = SyncDecisionCountsSerializer()
    run = SyncRunAgeSerializer()


class SyncRefusalSerializer(serializers.Serializer):
    detail = serializers.CharField()
    code = serializers.ChoiceField(choices=REFUSAL_CODES)
    status = serializers.IntegerField()
    decision_id = serializers.IntegerField(allow_null=True)


class SyncRevertedChangeSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    kind = serializers.ChoiceField(choices=KIND_CHOICES)


class SyncRevertBlockerSerializer(serializers.Serializer):
    change_id = serializers.IntegerField()
    kind = serializers.ChoiceField(choices=KIND_CHOICES)
    reason = serializers.ChoiceField(choices=REVERT_BLOCKER_CODES)
    text = serializers.CharField()


class SyncRevertResponseSerializer(serializers.Serializer):
    approval_id = serializers.IntegerField(help_text="The decision that would be reverted")
    decision_id = serializers.IntegerField(
        allow_null=True, help_text="The new revert decision, once written"
    )
    dry_run = serializers.BooleanField()
    outcome = serializers.ChoiceField(choices=SyncApprovalOutcome.choices)
    code = serializers.ChoiceField(choices=REVERT_REFUSAL_CODES, allow_null=True)
    detail = serializers.CharField()
    changes = SyncRevertedChangeSerializer(many=True)
    blockers = SyncRevertBlockerSerializer(many=True)
    reverted = serializers.IntegerField(min_value=0)
    skipped = serializers.IntegerField(min_value=0)


class SyncJournalCountsSerializer(serializers.Serializer):
    applied = serializers.IntegerField(required=False)
    rejected = serializers.IntegerField(required=False)
    reverted = serializers.IntegerField(required=False)
    skipped = serializers.IntegerField(required=False)
    waiting = serializers.IntegerField(required=False)
    superseded = serializers.IntegerField(required=False)
    remaining = serializers.IntegerField(required=False)
    blockers = serializers.IntegerField(required=False)
    deadline_seconds = serializers.IntegerField(required=False)
    plans_deduplicated = serializers.IntegerField(required=False)
    plans_deduplicated_by_move = serializers.IntegerField(required=False)
    kind = serializers.ChoiceField(choices=KIND_CHOICES, required=False)
    old_mode = serializers.ChoiceField(choices=SyncPolicyMode.choices, required=False)
    new_mode = serializers.ChoiceField(choices=SyncPolicyMode.choices, required=False)
    answer = serializers.ChoiceField(choices=MappingAnswer.choices, required=False)
    into = serializers.CharField(required=False, allow_null=True)
    action = serializers.ChoiceField(choices=UkmaDataDecisionAction.choices, required=False)
    target_id = serializers.CharField(required=False)
    related_id = serializers.CharField(required=False, allow_null=True)


class SyncJournalEntrySerializer(serializers.Serializer):
    id = serializers.IntegerField()
    kind = serializers.ChoiceField(choices=JOURNAL_KINDS)
    who = serializers.CharField(allow_null=True)
    when = serializers.DateTimeField()
    outcome = serializers.ChoiceField(choices=JOURNAL_OUTCOMES)
    error = serializers.CharField(allow_blank=True)
    counts = SyncJournalCountsSerializer()
    approval_id = serializers.IntegerField(allow_null=True)
    reverts_id = serializers.IntegerField(allow_null=True)
    group = serializers.ChoiceField(choices=SyncChangeGroup.choices, allow_null=True)
    revertible = serializers.BooleanField()
    revert_reason = serializers.CharField(allow_blank=True)
    reverted = serializers.BooleanField()


class SyncJournalResponseSerializer(serializers.Serializer):
    items = SyncJournalEntrySerializer(many=True)
    next_before = serializers.CharField(
        allow_null=True, help_text="Pass as `before` for the next page"
    )
