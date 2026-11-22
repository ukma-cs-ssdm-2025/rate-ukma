"""Serializers for the sync section of /data: runs, changes and policies.

`before` and `after` stay the run's JSON payloads; each payload carries its own
`display` snapshot, so the SPA renders a change without looking up ids.
"""

from __future__ import annotations

from django.utils import timezone
from rest_framework import serializers

from drf_spectacular.utils import extend_schema_field

from rating_app.models.sync import (
    MappingAnswer,
    SyncApprovalAction,
    SyncApprovalOutcome,
    SyncChange,
    SyncChangeGroup,
    SyncChangeState,
    SyncPolicyMode,
    SyncRun,
    SyncRunStatus,
    SyncSource,
)
from rating_app.sync.kinds import KIND_BY_NAME, NEVER_AUTO_KINDS


class SyncRunSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    source = serializers.ChoiceField(choices=SyncSource.choices, read_only=True)
    status = serializers.ChoiceField(choices=SyncRunStatus.choices, read_only=True)
    started_at = serializers.DateTimeField(read_only=True)
    finished_at = serializers.DateTimeField(read_only=True, allow_null=True)
    cursor_from = serializers.JSONField(read_only=True)
    cursor_to = serializers.JSONField(read_only=True)
    cursor_saved = serializers.JSONField(read_only=True)
    data_updated_at = serializers.DateTimeField(read_only=True, allow_null=True)
    counts = serializers.JSONField(read_only=True)
    error = serializers.CharField(read_only=True, allow_blank=True)
    age_seconds = serializers.SerializerMethodField()

    @extend_schema_field(serializers.IntegerField())
    def get_age_seconds(self, run: SyncRun) -> int:
        finished = run.finished_at or run.started_at
        return int((timezone.now() - finished).total_seconds())


class SyncChangeSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    run_id = serializers.IntegerField(read_only=True)
    source = serializers.ChoiceField(choices=SyncSource.choices, read_only=True)
    group = serializers.ChoiceField(choices=SyncChangeGroup.choices, read_only=True)
    kind = serializers.CharField(read_only=True)
    key = serializers.CharField(read_only=True)
    ukma_data_id = serializers.CharField(read_only=True, allow_null=True)
    target_id = serializers.CharField(read_only=True, allow_null=True)
    before = serializers.JSONField(read_only=True)
    after = serializers.JSONField(read_only=True)
    waiting_on = serializers.JSONField(read_only=True)
    ratings = serializers.IntegerField(read_only=True)
    state = serializers.ChoiceField(choices=SyncChangeState.choices, read_only=True)
    state_reason = serializers.CharField(read_only=True, allow_blank=True)
    never_auto = serializers.SerializerMethodField()
    decided_at = serializers.DateTimeField(read_only=True, allow_null=True)

    @extend_schema_field(serializers.BooleanField())
    def get_never_auto(self, change: SyncChange) -> bool:
        return change.kind in NEVER_AUTO_KINDS


class SyncPolicySerializer(serializers.Serializer):
    kind = serializers.CharField(read_only=True)
    source = serializers.ChoiceField(choices=SyncSource.choices, read_only=True)
    group = serializers.ChoiceField(choices=SyncChangeGroup.choices, read_only=True)
    mode = serializers.ChoiceField(choices=SyncPolicyMode.choices, read_only=True)
    never_auto = serializers.BooleanField(read_only=True)
    updated_by = serializers.IntegerField(read_only=True, allow_null=True)
    updated_at = serializers.DateTimeField(read_only=True, allow_null=True)


class SyncPolicyUpdateSerializer(serializers.Serializer):
    mode = serializers.ChoiceField(choices=SyncPolicyMode.choices)


class SyncSelectionFilterSerializer(serializers.Serializer):
    group = serializers.ChoiceField(choices=SyncChangeGroup.choices)
    kind = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    q = serializers.CharField(required=False, allow_null=True, allow_blank=True, max_length=200)
    rated = serializers.BooleanField(required=False, allow_null=True)
    match = serializers.ChoiceField(choices=["exact", "review"], required=False, allow_null=True)
    similar_existing = serializers.BooleanField(required=False, allow_null=True)
    fields_subset = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    changed_field = serializers.CharField(
        required=False, allow_null=True, allow_blank=True, max_length=50
    )
    blanks = serializers.BooleanField(required=False, allow_null=True)
    year_from = serializers.IntegerField(required=False, allow_null=True, min_value=2000)
    year_to = serializers.IntegerField(required=False, allow_null=True, min_value=2000)
    exclude_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1), required=False, max_length=500
    )


class SyncSelectionSerializer(serializers.Serializer):
    change_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1), required=False, allow_empty=False
    )
    filter = SyncSelectionFilterSerializer(required=False, allow_null=True)

    def validate(self, attrs: dict[str, object]) -> dict[str, object]:
        given = attrs.get("change_ids")
        filters = attrs.get("filter")
        if (given is None) == (filters is None):
            raise serializers.ValidationError("Вкажіть або зміни, або фільтр")
        if given is not None and len(given) > 200:  # pyright: ignore[reportArgumentType]  # ListField output
            raise serializers.ValidationError(
                {"change_ids": ["За ідентифікаторами можна застосувати до 200 змін"]}
            )
        return attrs


class SyncApproveRequestSerializer(serializers.Serializer):
    source = serializers.ChoiceField(choices=SyncSource.choices)
    group = serializers.ChoiceField(
        choices=SyncChangeGroup.choices, required=False, allow_null=True
    )
    kind = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    change_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        required=False,
        allow_empty=False,
        max_length=200,
    )
    run = serializers.IntegerField(required=False, allow_null=True, min_value=1)
    selection = SyncSelectionSerializer(required=False, allow_null=True)
    token = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    client_key = serializers.UUIDField(required=False, allow_null=True)
    dry_run = serializers.BooleanField(default=False)
    confirm_stale = serializers.BooleanField(default=False)

    def validate_kind(self, value: str | None) -> str | None:
        if value and value not in KIND_BY_NAME:
            raise serializers.ValidationError("Невідомий вид зміни")
        return value or None

    def validate(self, attrs: dict[str, object]) -> dict[str, object]:
        selection = attrs.get("selection")
        if selection is not None:
            if attrs.get("change_ids") is not None:
                raise serializers.ValidationError({"selection": ["Вкажіть або зміни, або фільтр"]})
            filters = selection.get("filter") if isinstance(selection, dict) else None
            if isinstance(filters, dict) and filters.get("group"):
                attrs["group"] = filters["group"]
        if not attrs.get("group") and not attrs.get("token"):
            raise serializers.ValidationError({"group": ["Вкажіть групу змін"]})
        return attrs


class SyncRejectRequestSerializer(serializers.Serializer):
    change_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1), required=False, allow_empty=False
    )
    source = serializers.ChoiceField(choices=SyncSource.choices, default=SyncSource.CATALOG)
    selection = SyncSelectionSerializer(required=False, allow_null=True)
    token = serializers.CharField(required=False, allow_null=True, allow_blank=True)

    def validate(self, attrs: dict[str, object]) -> dict[str, object]:
        if (attrs.get("change_ids") is None) == (attrs.get("selection") is None):
            raise serializers.ValidationError({"selection": ["Вкажіть або зміни, або вибірку"]})
        return attrs


class SyncAnswerRequestSerializer(serializers.Serializer):
    answer = serializers.ChoiceField(choices=MappingAnswer.choices)
    into = serializers.UUIDField(required=False, allow_null=True)


class SyncApprovalSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True, allow_null=True)
    action = serializers.ChoiceField(choices=SyncApprovalAction.choices, read_only=True)
    outcome = serializers.ChoiceField(choices=SyncApprovalOutcome.choices, read_only=True)
    counts = serializers.JSONField(read_only=True)
    error = serializers.CharField(read_only=True, allow_blank=True)


class SyncAnswerResponseSerializer(serializers.Serializer):
    decision_id = serializers.IntegerField(read_only=True)
    change_id = serializers.IntegerField(read_only=True)
    kind = serializers.CharField(read_only=True)
    answer = serializers.ChoiceField(choices=MappingAnswer.choices, read_only=True)
    ratings = serializers.IntegerField(read_only=True)


class SyncBulkAnswerResponseSerializer(serializers.Serializer):
    count = serializers.IntegerField(read_only=True)


class SyncPolicyChangeSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    kind = serializers.CharField(read_only=True)
    old_mode = serializers.ChoiceField(choices=SyncPolicyMode.choices, read_only=True)
    new_mode = serializers.ChoiceField(choices=SyncPolicyMode.choices, read_only=True)
    user = serializers.IntegerField(read_only=True, source="user_id")
    user_email = serializers.EmailField(read_only=True, source="user.email")
    changed_at = serializers.DateTimeField(read_only=True)


class SyncRunListResponseSerializer(serializers.Serializer):
    items = SyncRunSerializer(many=True)
    page = serializers.IntegerField()
    page_size = serializers.IntegerField()
    total = serializers.IntegerField()
    total_pages = serializers.IntegerField()
    next_page = serializers.IntegerField(allow_null=True, min_value=1)
    previous_page = serializers.IntegerField(allow_null=True, min_value=1)


class SyncChangeListResponseSerializer(serializers.Serializer):
    items = SyncChangeSerializer(many=True)
    page = serializers.IntegerField()
    page_size = serializers.IntegerField()
    total = serializers.IntegerField()
    total_pages = serializers.IntegerField()
    next_page = serializers.IntegerField(allow_null=True, min_value=1)
    previous_page = serializers.IntegerField(allow_null=True, min_value=1)


class SyncPendingResponseSerializer(SyncChangeListResponseSerializer):
    groups = serializers.DictField(
        child=serializers.IntegerField(),
        help_text="Waiting changes per group, before the request's group and kind filters.",
    )
    kinds = serializers.DictField(
        child=serializers.IntegerField(),
        help_text="Waiting changes per kind, before the request's group and kind filters.",
    )
    runs = SyncRunSerializer(many=True, help_text="Each listed source's current run.")


class SyncPolicyListResponseSerializer(serializers.Serializer):
    items = SyncPolicySerializer(many=True)


class SyncPolicyChangeListResponseSerializer(serializers.Serializer):
    items = SyncPolicyChangeSerializer(many=True)
    page = serializers.IntegerField()
    page_size = serializers.IntegerField()
    total = serializers.IntegerField()
    total_pages = serializers.IntegerField()
    next_page = serializers.IntegerField(allow_null=True, min_value=1)
    previous_page = serializers.IntegerField(allow_null=True, min_value=1)
