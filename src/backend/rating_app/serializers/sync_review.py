"""Serializers for the review screen of the sync section: summary, questions,
preview tokens and the approval history.

The summary and the facets are computed by `rating_app.sync.review`; these
classes only fix the shape a generated client sees.
"""

from __future__ import annotations

from rest_framework import serializers

from rating_app.models.sync import (
    MappingAnswer,
    SyncApprovalAction,
    SyncApprovalOutcome,
    SyncApprovalScope,
    SyncChangeGroup,
)
from rating_app.serializers.sync import (
    SyncRunSerializer,
)


class SyncSummaryStepSerializer(serializers.Serializer):
    step = serializers.CharField()
    group = serializers.ChoiceField(choices=SyncChangeGroup.choices)
    kinds = serializers.DictField(child=serializers.IntegerField())
    count = serializers.IntegerField()
    rated = serializers.IntegerField()
    ratings = serializers.IntegerField()
    plans = serializers.IntegerField()
    waiting = serializers.IntegerField()
    facets = serializers.JSONField()


class SyncSummaryAnswersSerializer(serializers.Serializer):
    merge = serializers.IntegerField()
    keep_apart = serializers.IntegerField()
    keep = serializers.IntegerField()
    place = serializers.IntegerField()
    move = serializers.IntegerField()


class SyncNotProposedSerializer(serializers.Serializer):
    count = serializers.IntegerField()
    rated = serializers.IntegerField()


class SyncGroupPartsSerializer(serializers.Serializer):
    courses = serializers.IntegerField()
    offerings = serializers.IntegerField()
    faculties = serializers.IntegerField()
    departments = serializers.IntegerField()
    total = serializers.IntegerField()


class SyncValuePairSerializer(serializers.Serializer):
    before = serializers.CharField(allow_blank=True)
    after = serializers.CharField(allow_blank=True)
    count = serializers.IntegerField()


class SyncFieldRowSerializer(serializers.Serializer):
    field = serializers.CharField()
    count = serializers.IntegerField()
    pairs = SyncValuePairSerializer(many=True)


class SyncChangeGroupPartsSerializer(serializers.Serializer):
    total = serializers.IntegerField()
    offerings = serializers.IntegerField()
    by_field = SyncFieldRowSerializer(many=True)
    blanking = SyncFieldRowSerializer(many=True)


class SyncMergeGroupPartsSerializer(serializers.Serializer):
    total = serializers.IntegerField()
    rated = serializers.IntegerField()
    ratings = serializers.IntegerField()
    unrated = serializers.IntegerField()


class SyncPlacementGroupPartsSerializer(serializers.Serializer):
    total = serializers.IntegerField()
    place = serializers.IntegerField()
    move = serializers.IntegerField()


class SyncGroupTotalSerializer(serializers.Serializer):
    total = serializers.IntegerField()


class SyncSummaryGroupsSerializer(serializers.Serializer):
    links = SyncGroupPartsSerializer()
    new = SyncGroupPartsSerializer()
    changes = SyncChangeGroupPartsSerializer()
    merges = SyncMergeGroupPartsSerializer()
    placements = SyncPlacementGroupPartsSerializer()
    removed = SyncGroupTotalSerializer()
    other = SyncGroupTotalSerializer()


class SyncSummarySerializer(serializers.Serializer):
    run = SyncRunSerializer()
    newer_run_id = serializers.IntegerField(allow_null=True)
    groups = SyncSummaryGroupsSerializer()
    steps = SyncSummaryStepSerializer(many=True)
    answers = SyncSummaryAnswersSerializer()
    not_proposed = serializers.DictField(child=SyncNotProposedSerializer())


class SyncQuestionOfferingSerializer(serializers.Serializer):
    saz_code = serializers.CharField()
    year = serializers.IntegerField()
    term = serializers.CharField()
    ratings = serializers.IntegerField()


class SyncQuestionCourseSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    title = serializers.CharField()
    department = serializers.CharField()
    years = serializers.ListField(child=serializers.IntegerField())
    offerings = SyncQuestionOfferingSerializer(many=True)
    ratings = serializers.IntegerField()
    plans = serializers.IntegerField()
    title_matches_ukma = serializers.BooleanField()
    holds_ukma_id = serializers.BooleanField()
    url = serializers.CharField()


class SyncQuestionAnswerSerializer(serializers.Serializer):
    answer = serializers.ChoiceField(choices=MappingAnswer.choices)
    into = serializers.CharField(allow_null=True)
    decided_at = serializers.DateTimeField()


class SyncQuestionSemesterSerializer(serializers.Serializer):
    saz_code = serializers.CharField(allow_blank=True)
    year = serializers.IntegerField()
    term = serializers.CharField()


class SyncQuestionSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    kind = serializers.CharField()
    key = serializers.CharField()
    ukma_data_id = serializers.CharField(allow_null=True)
    ukma_title = serializers.CharField(allow_null=True)
    ukma_department = serializers.CharField(allow_null=True)
    offering = SyncQuestionSemesterSerializer(allow_null=True)
    move_into = serializers.UUIDField(allow_null=True)
    ratings = serializers.IntegerField()
    plans = serializers.IntegerField()
    courses = SyncQuestionCourseSerializer(many=True)
    suggested_into = serializers.UUIDField(allow_null=True)
    answer = SyncQuestionAnswerSerializer(allow_null=True)


class SyncQuestionListResponseSerializer(serializers.Serializer):
    items = SyncQuestionSerializer(many=True)
    next_after = serializers.CharField(allow_null=True)


class SyncQuestionAnswerRequestSerializer(serializers.Serializer):
    answer = serializers.ChoiceField(choices=MappingAnswer.choices)
    into = serializers.UUIDField(required=False, allow_null=True, default=None)
    dry_run = serializers.BooleanField(default=True)


class SyncQuestionAnswerResponseSerializer(serializers.Serializer):
    change_id = serializers.IntegerField()
    answer = serializers.ChoiceField(choices=MappingAnswer.choices)
    into = serializers.UUIDField(allow_null=True)
    ratings = serializers.IntegerField()
    settles = serializers.BooleanField()
    dry_run = serializers.BooleanField()
    detail = serializers.CharField()


class SyncMergedCourseSerializer(serializers.Serializer):
    from_id = serializers.CharField()
    into_id = serializers.CharField()
    title = serializers.CharField()


class SyncApprovalDetailSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    run_id = serializers.IntegerField()
    action = serializers.ChoiceField(choices=SyncApprovalAction.choices)
    scope = serializers.ChoiceField(choices=SyncApprovalScope.choices)
    group = serializers.CharField(allow_blank=True)
    kind = serializers.CharField(allow_blank=True)
    outcome = serializers.ChoiceField(choices=SyncApprovalOutcome.choices)
    counts = serializers.JSONField()
    error = serializers.CharField(allow_blank=True)
    user_email = serializers.EmailField(allow_null=True)
    created_at = serializers.DateTimeField()
    selection = serializers.CharField()
    ratings_moved = serializers.IntegerField()
    plans_moved = serializers.IntegerField()
    merged = SyncMergedCourseSerializer(many=True)


class SyncApprovalListResponseSerializer(serializers.Serializer):
    items = SyncApprovalDetailSerializer(many=True)
    page = serializers.IntegerField()
    page_size = serializers.IntegerField()
    total = serializers.IntegerField()
    total_pages = serializers.IntegerField()
    next_page = serializers.IntegerField(allow_null=True, min_value=1)
    previous_page = serializers.IntegerField(allow_null=True, min_value=1)
