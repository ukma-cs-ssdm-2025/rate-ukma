from __future__ import annotations

from typing import Any, cast

from django.db import transaction
from django.db.models import Count, QuerySet
from rest_framework import status
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.request import Request
from rest_framework.response import Response

import structlog
from drf_spectacular.utils import OpenApiParameter, extend_schema

from rating_app.application_schemas.sync import (
    SyncChangeListParams,
    SyncListParams,
    SyncPendingParams,
    SyncRunChangesPathParams,
    SyncRunListParams,
)
from rating_app.ioc_container.common import pydantic_to_openapi_request_mapper
from rating_app.models.sync import (
    SyncApproval,
    SyncApprovalOutcome,
    SyncChange,
    SyncChangeState,
    SyncPolicy,
    SyncPolicyChange,
    SyncPolicyMode,
    SyncRun,
    SyncRunStatus,
    SyncSource,
)
from rating_app.serializers.sync import (
    SyncAnswerRequestSerializer,
    SyncAnswerResponseSerializer,
    SyncApprovalSerializer,
    SyncApproveRequestSerializer,
    SyncBulkAnswerResponseSerializer,
    SyncChangeListResponseSerializer,
    SyncPendingResponseSerializer,
    SyncPolicyChangeListResponseSerializer,
    SyncPolicyListResponseSerializer,
    SyncPolicySerializer,
    SyncPolicyUpdateSerializer,
    SyncRejectRequestSerializer,
    SyncRunListResponseSerializer,
)
from rating_app.sync import answers, apply, review, selection
from rating_app.sync.apply import SyncApplyInputError
from rating_app.sync.kinds import KIND_BY_NAME, KINDS, NEVER_AUTO_KINDS, SyncKind
from rating_app.sync.policies import set_mode
from rating_app.views.responses import (
    R_SYNC_ANSWER,
    R_SYNC_APPROVE,
    R_SYNC_BULK_ANSWER,
    R_SYNC_CHANGES,
    R_SYNC_PENDING,
    R_SYNC_POLICIES,
    R_SYNC_POLICY,
    R_SYNC_POLICY_CHANGES,
    R_SYNC_RUNS,
)
from rating_app.views.sync_base import SyncViewSetBase, input_error_text

logger = structlog.get_logger(__name__)
to_openapi = pydantic_to_openapi_request_mapper().map


def _counts_by(queryset: QuerySet[SyncChange], field: str) -> dict[str, int]:
    return {
        str(row[field]): int(row["count"])
        for row in queryset.values(field).annotate(count=Count("id"))
    }


def _policy_payload(kind: SyncKind, policy: SyncPolicy | None) -> dict[str, Any]:
    return {
        "kind": kind.name,
        "source": kind.source,
        "group": kind.group,
        "mode": policy.mode if policy is not None else SyncPolicyMode.NEEDS_APPROVAL,
        "never_auto": kind.name in NEVER_AUTO_KINDS,
        "updated_by": policy.updated_by_id if policy is not None else None,
        "updated_at": policy.updated_at if policy is not None else None,
    }


@extend_schema(tags=["ukma-data"])
class SyncViewSet(SyncViewSetBase):
    """Runs, changes and policies of the syncs from UKMA Data, for /data."""

    @extend_schema(
        summary="List sync runs",
        description="Run history, newest first: status, cursors and counts per group. "
        "Superusers only.",
        parameters=to_openapi((SyncRunListParams, OpenApiParameter.QUERY)),
        responses=R_SYNC_RUNS,
        operation_id="ukma_data_sync_runs_list",
    )
    def runs(self, request: Request) -> Response:
        params = self._query(request, SyncRunListParams)
        queryset = SyncRun.objects.order_by("-started_at", "-id")
        if params.source is not None:
            queryset = queryset.filter(source=params.source)

        page = self._paginate(queryset, params)
        payload = SyncRunListResponseSerializer(
            {"items": page.page_objects, **page.metadata.model_dump()}
        )
        return Response(payload.data, status=status.HTTP_200_OK)

    @extend_schema(
        summary="List one sync run's changes",
        description="Every change the run recorded, rated rows first, filterable by "
        "group, kind and state. Superusers only.",
        parameters=[
            *to_openapi((SyncRunChangesPathParams, OpenApiParameter.PATH)),
            *to_openapi((SyncChangeListParams, OpenApiParameter.QUERY)),
        ],
        responses=R_SYNC_CHANGES,
        operation_id="ukma_data_sync_run_changes_list",
    )
    def run_changes(self, request: Request, run_id: str | None = None) -> Response:
        path = self._validated(SyncRunChangesPathParams, {"run_id": run_id})
        params = self._query(request, SyncChangeListParams)

        run = SyncRun.objects.filter(pk=path.run_id).first()
        if run is None:
            raise NotFound("Sync run not found")

        changes = self._filter_changes(SyncChange.objects.filter(run=run), params)
        page = self._paginate(changes, params)
        payload = SyncChangeListResponseSerializer(
            {"items": page.page_objects, **page.metadata.model_dump()}
        )
        return Response(payload.data, status=status.HTTP_200_OK)

    @extend_schema(
        summary="List the changes waiting for approval",
        description="Proposed changes of each source's current (latest succeeded) run or "
        "of a pinned `run`, rated rows first. Supports the review facets: `match`, "
        "`similar_existing`, a `field` or `fields_subset`, a title or САЗ `q`, and a "
        "`view=sample` of up to 20 rows per faculty. `groups` and `kinds` count every "
        "waiting change before the group and kind filters. Superusers only.",
        parameters=to_openapi((SyncPendingParams, OpenApiParameter.QUERY)),
        responses=R_SYNC_PENDING,
        operation_id="ukma_data_sync_pending_list",
    )
    def pending(self, request: Request) -> Response:
        params = self._query(request, SyncPendingParams)
        if params.run is not None:
            run = SyncRun.objects.filter(pk=params.run).first()
            if run is None:
                raise NotFound("Sync run not found")
            runs = [run]
        else:
            runs = self._current_runs(params.source)
        state = params.state or SyncChangeState.PROPOSED
        base = SyncChange.objects.filter(run_id__in=[run.id for run in runs], state=state)

        changes = self._filter_changes(base, params)
        if params.rated is not None:
            changes = changes.filter(ratings__gt=0) if params.rated else changes.filter(ratings=0)
        changes = selection.pending_ids(
            changes,
            match=params.match,
            similar_existing=params.similar_existing,
            field=params.field,
            fields_subset=params.fields_subset,
            q=params.q,
        )
        if params.view == "sample":
            items, metadata = self._sample_page(review.sample_ids(changes, params.seed), params)
        else:
            page = self._paginate(changes, params)
            items, metadata = page.page_objects, page.metadata.model_dump()
        payload = SyncPendingResponseSerializer(
            {
                "items": items,
                "groups": _counts_by(base, "group"),
                "kinds": _counts_by(base, "kind"),
                "runs": runs,
                **metadata,
            }
        )
        return Response(payload.data, status=status.HTTP_200_OK)

    @extend_schema(
        summary="List sync policies",
        description="Every kind in the registry with its source, group, mode and whether "
        "it can ever be automatic. A kind with no policy row waits for approval. "
        "Superusers only.",
        responses=R_SYNC_POLICIES,
        operation_id="ukma_data_sync_policies_list",
    )
    def policies(self, request: Request) -> Response:
        policies = {policy.kind: policy for policy in SyncPolicy.objects.all()}
        items = [_policy_payload(kind, policies.get(kind.name)) for kind in KINDS]
        payload = SyncPolicyListResponseSerializer({"items": items})
        return Response(payload.data, status=status.HTTP_200_OK)

    @extend_schema(
        summary="Set one sync kind's policy",
        description="Set a kind to `auto` or `needs_approval` and write the audit row. "
        "Mapping kinds and kinds that move ratings cannot be `auto`. Superusers only.",
        request=SyncPolicyUpdateSerializer,
        responses=R_SYNC_POLICY,
        operation_id="ukma_data_sync_policy_update",
    )
    def update_policy(self, request: Request, kind: str | None = None) -> Response:
        kind_name = str(kind)
        registry_kind = KIND_BY_NAME.get(kind_name)
        if registry_kind is None:
            raise NotFound(f"Unknown sync kind: {kind_name}")

        serializer = SyncPolicyUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        mode = cast(dict[str, str], serializer.validated_data)["mode"]

        try:
            policy = set_mode(kind_name, mode, request.user)
        except ValueError as exc:  # NeverAutoKindError among them
            raise ValidationError({"mode": [str(exc)]}) from exc

        logger.info("sync_policy_updated", kind=kind_name, mode=mode, user_id=request.user.pk)
        payload = SyncPolicySerializer(_policy_payload(registry_kind, policy))
        return Response(payload.data, status=status.HTTP_200_OK)

    @extend_schema(
        summary="Approve sync changes",
        description="Apply the selected proposed changes, expanded to their whole unit. "
        "Select by up to 200 `change_ids`, or by a `selection.filter` confirmed with the "
        "`token` from `preview/`; the filter is resolved again and a changed set answers "
        "409 `selection_changed`. Send a `client_key` so a retry returns the first "
        "approval instead of applying twice. `dry_run` previews the same apply and rolls "
        "it back; a run over 48 h old needs `confirm_stale`. Superusers only.",
        request=SyncApproveRequestSerializer,
        responses=R_SYNC_APPROVE,
        operation_id="ukma_data_sync_approve",
    )
    def approve(self, request: Request) -> Response:
        serializer = SyncApproveRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = cast(dict[str, Any], serializer.validated_data)
        dry_run = bool(data.get("dry_run"))
        client_key = data.get("client_key")
        if client_key is not None and not dry_run:
            existing = SyncApproval.objects.filter(client_key=client_key).first()
            if existing is not None:
                logger.info(
                    "sync_approve_replayed",
                    approval_id=existing.pk,
                    client_key=str(client_key),
                    user_id=request.user.pk,
                )
                return self._approval_response(existing, dry_run=False, user=request.user)

        ids = self._resolve_approve_ids(data, request)
        if isinstance(ids, Response):
            return ids
        try:
            if dry_run:
                with transaction.atomic():
                    approval = apply.approve(
                        ids,
                        request.user,
                        confirm_old_run=bool(data.get("confirm_stale")),
                        client_key=None,
                    )
                    transaction.set_rollback(True)
            else:
                approval = apply.approve(
                    ids,
                    request.user,
                    confirm_old_run=bool(data.get("confirm_stale")),
                    client_key=client_key,
                )
        except SyncApplyInputError as exc:
            raise ValidationError({"change_ids": [input_error_text(exc)]}) from exc

        logger.info(
            "sync_approve_requested",
            approval_id=approval.pk,
            change_ids=ids,
            dry_run=dry_run,
            outcome=approval.outcome,
            user_id=request.user.pk,
        )
        return self._approval_response(approval, dry_run=dry_run, user=request.user)

    @extend_schema(
        summary="Reject sync changes",
        description="Mark the selected proposed changes rejected and supersede the "
        "changes waiting on them. Superusers only.",
        request=SyncRejectRequestSerializer,
        responses=R_SYNC_APPROVE,
        operation_id="ukma_data_sync_reject",
    )
    def reject(self, request: Request) -> Response:
        serializer = SyncRejectRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        validated = cast(dict[str, Any], serializer.validated_data)
        ids = cast(list[int], validated["change_ids"])
        try:
            approval = apply.reject(ids, request.user)
        except SyncApplyInputError as exc:
            raise ValidationError({"change_ids": [input_error_text(exc)]}) from exc

        logger.info(
            "sync_reject_requested",
            approval_id=approval.pk,
            change_ids=ids,
            outcome=approval.outcome,
            user_id=request.user.pk,
        )
        return self._approval_response(approval, dry_run=False, user=request.user)

    @extend_schema(
        summary="Answer a mapping question",
        description="Write a staff answer to a mapping change with the premise the "
        "builder recorded and the live rating count. Mapping kinds only. Superusers only.",
        request=SyncAnswerRequestSerializer,
        responses=R_SYNC_ANSWER,
        operation_id="ukma_data_sync_change_answer",
    )
    def answer_change(self, request: Request, change_id: str | None = None) -> Response:
        change = SyncChange.objects.filter(pk=change_id).first()
        if change is None:
            raise NotFound("Зміну не знайдено")

        serializer = SyncAnswerRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = cast(dict[str, Any], serializer.validated_data)
        into = data.get("into")
        try:
            decision = answers.answer_change(
                change,
                data["answer"],
                request.user,
                into=None if into is None else str(into),
            )
        except answers.MappingAnswerError as exc:
            raise ValidationError({"answer": [str(exc)]}) from exc

        logger.info(
            "sync_change_answered",
            change_id=change.pk,
            kind=change.kind,
            answer=decision.answer,
            decision_id=decision.pk,
            user_id=request.user.pk,
        )
        payload = SyncAnswerResponseSerializer(
            {
                "decision_id": decision.pk,
                "change_id": change.pk,
                "kind": decision.kind,
                "answer": decision.answer,
                "ratings": decision.premise.get("ratings", 0),
            }
        )
        return Response(payload.data, status=status.HTTP_200_OK)

    @extend_schema(
        summary="Keep every unrated mapping question apart",
        description="Write `keep_apart` or `keep` for every unanswered mapping question "
        "of the current catalog run with no ratings on any side. Returns how many it "
        "answered. Superusers only.",
        request=None,
        responses=R_SYNC_BULK_ANSWER,
        operation_id="ukma_data_sync_mapping_keep_apart_unrated",
    )
    def keep_apart_unrated(self, request: Request) -> Response:
        count = answers.keep_apart_unrated(request.user)

        logger.info(
            "sync_unrated_kept_apart",
            count=count,
            user_id=request.user.pk,
        )
        payload = SyncBulkAnswerResponseSerializer({"count": count})
        return Response(payload.data, status=status.HTTP_200_OK)

    @extend_schema(
        summary="List sync policy changes",
        description="The policy audit, newest first: who set which kind from which mode "
        "to which. Superusers only.",
        parameters=to_openapi((SyncListParams, OpenApiParameter.QUERY)),
        responses=R_SYNC_POLICY_CHANGES,
        operation_id="ukma_data_sync_policy_changes_list",
    )
    def policy_changes(self, request: Request) -> Response:
        params = self._query(request, SyncListParams)
        queryset = SyncPolicyChange.objects.select_related("user").order_by("-changed_at", "-id")

        page = self._paginate(queryset, params)
        payload = SyncPolicyChangeListResponseSerializer(
            {"items": page.page_objects, **page.metadata.model_dump()}
        )
        return Response(payload.data, status=status.HTTP_200_OK)

    def _resolve_approve_ids(self, data: dict[str, Any], request: Request) -> list[int] | Response:
        selection_data = data.get("selection")
        token = data.get("token") or None
        if token:
            parsed = selection.parse_token(token)
            run = None if parsed is None else SyncRun.objects.filter(pk=parsed[0]).first()
            if parsed is None or run is None:
                raise ValidationError({"token": ["Некоректний токен"]})
            if selection_data is None:
                raise ValidationError({"selection": ["Потрібна вибірка для перевірки токена"]})
            ids = self._selection_ids(selection_data, run, data["source"])
            if selection.token_for(run.pk, ids) != token:
                before = selection.preview_count(token) or 0
                detail = f"Список змінився: було {before}, стало {len(ids)}. Перегляньте ще раз"
                return Response(
                    {
                        "detail": detail,
                        "code": "selection_changed",
                        "status": 409,
                        "holder": self._holder(request.user, lock_held=False),
                        "run_age_hours": self._age_hours(run),
                    },
                    status=status.HTTP_409_CONFLICT,
                )
            return ids
        if selection_data is not None:
            raise ValidationError({"token": ["Спочатку перегляньте вибірку"]})
        return self._approve_selection(data)

    def _approve_selection(self, data: dict[str, Any]) -> list[int]:
        source = data["source"]
        group = data["group"]
        kind = data.get("kind")
        given = data.get("change_ids")
        if given:
            queryset = SyncChange.objects.filter(pk__in=given, source=source, group=group)
        else:
            run = self._current_run(source)
            if run is None:
                raise ValidationError({"source": ["Немає успішного запуску для цього джерела"]})
            queryset = SyncChange.objects.filter(run=run, source=source, group=group)
        if kind:
            queryset = queryset.filter(kind=kind)

        ids = list(queryset.values_list("pk", flat=True))
        if not ids:
            raise ValidationError({"change_ids": ["Немає запропонованих змін для цієї вибірки"]})
        return ids

    def _skipped_count(self, approval: SyncApproval, counts: dict[str, Any]) -> int:
        remaining = SyncChange.objects.filter(
            pk__in=approval.change_ids, state=SyncChangeState.PROPOSED
        ).count()
        return max(0, remaining - int(counts.get("waiting") or 0))

    def _approval_response(self, approval: SyncApproval, *, dry_run: bool, user: Any) -> Response:
        if approval.outcome == SyncApprovalOutcome.REFUSED:
            return self._refusal(approval, user)
        if approval.outcome == SyncApprovalOutcome.FAILED:
            return Response(
                {
                    "detail": "Не вдалося застосувати зміни",
                    "error": approval.error,
                    "status": status.HTTP_500_INTERNAL_SERVER_ERROR,
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        counts = {str(key): value for key, value in approval.counts.items()}
        counts.setdefault("skipped", 0)
        if not dry_run and approval.outcome == SyncApprovalOutcome.APPLIED:
            counts["skipped"] = self._skipped_count(approval, counts)
        payload = SyncApprovalSerializer(
            {
                "id": None if dry_run else approval.pk,
                "action": approval.action,
                "outcome": approval.outcome,
                "counts": counts,
                "error": approval.error,
            }
        )
        return Response(payload.data, status=status.HTTP_200_OK)

    def _current_run(self, source: str) -> SyncRun | None:
        return (
            SyncRun.objects.filter(source=source, status=SyncRunStatus.SUCCEEDED)
            .order_by("-finished_at", "-id")
            .first()
        )

    def _current_runs(self, source: SyncSource | None) -> list[SyncRun]:
        sources = [source] if source is not None else list(SyncSource)
        runs: list[SyncRun] = []
        for value in sources:
            run = (
                SyncRun.objects.filter(source=value, status=SyncRunStatus.SUCCEEDED)
                .order_by("-finished_at", "-id")
                .first()
            )
            if run is not None:
                runs.append(run)
        return runs

    def _filter_changes(
        self, queryset: QuerySet[SyncChange], params: SyncChangeListParams
    ) -> QuerySet[SyncChange]:
        if params.group is not None:
            queryset = queryset.filter(group=params.group)
        if params.kind is not None:
            queryset = queryset.filter(kind=params.kind)
        if params.state is not None:
            queryset = queryset.filter(state=params.state)
        return queryset.order_by("-ratings", "id")
