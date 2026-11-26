"""Serializers for the sync section of /data: runs, changes and policies.

`before` and `after` stay the run's JSON payloads; each payload carries its own
`display` snapshot, so the SPA renders a change without looking up ids.
"""

from __future__ import annotations

from dataclasses import asdict
from typing import Any

from django.utils import timezone
from rest_framework import serializers

from drf_spectacular.utils import extend_schema_field

from rating_app.models.sync import (
    SyncChange,
    SyncChangeGroup,
    SyncChangeState,
    SyncPolicyMode,
    SyncRun,
    SyncRunStatus,
    SyncSource,
)
from rating_app.sync.kinds import NEVER_AUTO_KINDS
from rating_app.sync.view import change_view


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


class SyncChangeFieldViewSerializer(serializers.Serializer):
    field = serializers.CharField(read_only=True)
    label = serializers.CharField(read_only=True)
    before = serializers.CharField(read_only=True, allow_blank=True)
    after = serializers.CharField(read_only=True, allow_blank=True)


class SyncChangeViewSerializer(serializers.Serializer):
    """The change in plain words: name, department, semester and the fields a
    student would notice, old and new."""

    title = serializers.CharField(read_only=True)
    place = serializers.CharField(read_only=True, allow_null=True)
    semester = serializers.CharField(read_only=True, allow_null=True)
    rows = SyncChangeFieldViewSerializer(many=True, read_only=True)
    note = serializers.CharField(
        read_only=True,
        allow_null=True,
        help_text="What a new record is, e.g. a new semester of a known discipline",
    )


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
    view = serializers.SerializerMethodField()

    @extend_schema_field(serializers.BooleanField())
    def get_never_auto(self, change: SyncChange) -> bool:
        return change.kind in NEVER_AUTO_KINDS

    @extend_schema_field(SyncChangeViewSerializer())
    def get_view(self, change: SyncChange) -> dict[str, Any]:
        return asdict(change_view(change))


class SyncPolicySerializer(serializers.Serializer):
    kind = serializers.CharField(read_only=True)
    source = serializers.ChoiceField(choices=SyncSource.choices, read_only=True)
    group = serializers.ChoiceField(choices=SyncChangeGroup.choices, read_only=True)
    mode = serializers.ChoiceField(choices=SyncPolicyMode.choices, read_only=True)
    never_auto = serializers.BooleanField(read_only=True)
    updated_by = serializers.IntegerField(read_only=True, allow_null=True)
    updated_at = serializers.DateTimeField(read_only=True, allow_null=True)


SELECTION_GROUP_CHOICES = [*SyncChangeGroup.choices, ("other", "Other")]


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
    changed_fields = serializers.DictField(
        child=serializers.IntegerField(),
        help_text="Field-change rows per changed field a student sees, after every filter "
        "except `changed_field`.",
    )


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
