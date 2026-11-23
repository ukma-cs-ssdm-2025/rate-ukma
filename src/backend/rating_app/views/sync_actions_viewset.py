"""Superuser endpoints that decide sync changes: preview, apply, reject, revert
and the journal. Every decision goes through `rating_app.sync.decisions` and the
journal reads `rating_app.sync.journal`, so the console and the UI take one path.
"""

from __future__ import annotations

from collections import Counter
from datetime import datetime
from typing import Any, cast

from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.request import Request
from rest_framework.response import Response

import structlog
from drf_spectacular.utils import OpenApiParameter, extend_schema

from rating_app.application_schemas.sync import SyncJournalParams
from rating_app.ioc_container.common import pydantic_to_openapi_request_mapper
from rating_app.models.sync import (
    SyncApproval,
    SyncApprovalOutcome,
    SyncChange,
    SyncChangeState,
    SyncRun,
)
from rating_app.serializers.sync_actions import (
    SyncApplyRequestSerializer,
    SyncDecisionResponseSerializer,
    SyncJournalResponseSerializer,
    SyncPreviewRequestSerializer,
    SyncPreviewResponseSerializer,
    SyncRefusalSerializer,
    SyncRejectRequestSerializer,
    SyncRevertRequestSerializer,
    SyncRevertResponseSerializer,
)
from rating_app.sync import console as text
from rating_app.sync import decisions, selection
from rating_app.sync import journal as sync_journal
from rating_app.sync.answers import MAPPING_KINDS
from rating_app.sync.kinds import KINDS
from rating_app.views.responses import (
    R_SYNC_APPLY,
    R_SYNC_JOURNAL,
    R_SYNC_PREVIEW,
    R_SYNC_REJECT,
    R_SYNC_REVERT,
)
from rating_app.views.sync_base import SyncViewSetBase

logger = structlog.get_logger(__name__)
to_openapi = pydantic_to_openapi_request_mapper().map

MAX_CHANGES = 5000
DEADLINE_SECONDS = 40

REFUSAL_STATUS: dict[str, int] = {
    "selection_changed": status.HTTP_409_CONFLICT,
    "lock_held": status.HTTP_409_CONFLICT,
    "run_not_current": status.HTTP_409_CONFLICT,
    "run_too_old": status.HTTP_409_CONFLICT,
    "deadline_exceeded": status.HTTP_422_UNPROCESSABLE_ENTITY,
    "no_proposed_changes": status.HTTP_422_UNPROCESSABLE_ENTITY,
}

_WAITING_ON_TEXT = "чекає на інші зміни (спершу застосуйте їх або вкажіть усю групу)"
_MAPPING_TEXT = "питання без відповіді: спершу дайте відповідь"
_NOT_READY_TEXT = "пропущено цього разу (рядок на сайті змінився або вибірку звужено)"


@extend_schema(tags=["ukma-data"])
class SyncActionsViewSet(SyncViewSetBase):
    """Preview, apply, reject and revert sync changes, and read the journal."""

    @extend_schema(
        summary="Preview a sync selection",
        description="Dry-run the apply of a run's group (optionally one kind) or of explicit "
        "`change_ids` and roll it back. Returns a token that binds «Застосувати» to this "
        "exact set, what would apply per kind, what stays and why, how many changes the "
        "5 000 cap leaves for the next request, and the run's data age. Superusers only.",
        request=SyncPreviewRequestSerializer,
        responses=R_SYNC_PREVIEW,
        operation_id="ukma_data_sync_preview",
    )
    def preview(self, request: Request) -> Response:
        data = self._body(SyncPreviewRequestSerializer, request)
        run = self._run(data)
        ids, group, kind = self._selection(data, run)
        try:
            preview = decisions.preview(
                ids,
                request.user,
                group=group,
                kind=kind,
                max_changes=MAX_CHANGES,
            )
        except decisions.SyncApplyInputError as exc:
            raise _input_error(exc) from exc
        result = preview.result
        if result.outcome != SyncApprovalOutcome.APPLIED:
            return _refusal(result, run)
        applied = result.decided(SyncChangeState.APPLIED)
        skipped, waiting = _left_out(result, applied)
        payload = SyncPreviewResponseSerializer(
            {
                "token": preview.token,
                "dry_run": True,
                "outcome": result.outcome,
                "error": "",
                "detail": _preview_detail(len(applied)),
                "counts": _counts(result, applied=applied),
                "skipped_reasons": _reasons(skipped),
                "waiting_reasons": _reasons(waiting),
                "run": _run_payload(run),
            }
        )
        return Response(payload.data, status=status.HTTP_200_OK)

    @extend_schema(
        summary="Apply a previewed sync selection",
        description="Apply at most 5 000 changes of the previewed selection, lowest change "
        "numbers first, and stop by 40 s. The `token` from `preview` must match the "
        "selection again; a changed set answers 409 `selection_changed`. A retry with the "
        "same `client_key` returns the first decision with 200 instead of applying twice. "
        "Superusers only.",
        request=SyncApplyRequestSerializer,
        responses=R_SYNC_APPLY,
        operation_id="ukma_data_sync_apply",
    )
    def apply(self, request: Request) -> Response:
        data = self._body(SyncApplyRequestSerializer, request)
        replayed = _replay(data["client_key"])
        if replayed is not None:
            return _replay_response(replayed)
        run = self._run(data)
        ids, group, kind = self._selection(data, run)
        try:
            result = decisions.approve(
                ids,
                request.user,
                dry_run=False,
                group=group,
                kind=kind,
                client_key=data["client_key"],
                max_changes=MAX_CHANGES,
                deadline_seconds=DEADLINE_SECONDS,
                preview_token=str(data["token"]),
            )
        except decisions.SyncApplyInputError as exc:
            raise _input_error(exc) from exc
        if result.outcome != SyncApprovalOutcome.APPLIED:
            return _refusal(result, run)
        applied = result.decided(SyncChangeState.APPLIED)
        payload = SyncDecisionResponseSerializer(
            {
                "decision_id": result.approval_id,
                "action": result.action,
                "outcome": result.outcome,
                "detail": _decision_detail(
                    action="apply",
                    count=len(applied),
                    remaining=result.remaining,
                    decision_id=result.approval_id,
                ),
                "counts": _counts(result, applied=applied),
                "run": _run_payload(run),
            }
        )
        return Response(payload.data, status=status.HTTP_200_OK)

    @extend_schema(
        summary="Reject a sync selection",
        description="Mark the selected proposed changes rejected and supersede the changes "
        "waiting on them; nothing on the site changes. A rejected change comes back after "
        "the next read if САЗ still differs. A retry with the same `client_key` returns "
        "the first decision with 200. Superusers only.",
        request=SyncRejectRequestSerializer,
        responses=R_SYNC_REJECT,
        operation_id="ukma_data_sync_reject",
    )
    def reject(self, request: Request) -> Response:
        data = self._body(SyncRejectRequestSerializer, request)
        replayed = _replay(data["client_key"])
        if replayed is not None:
            return _replay_response(replayed)
        run = self._run(data)
        ids, _, _ = self._selection(data, run)
        try:
            result = decisions.reject(
                ids,
                request.user,
                dry_run=False,
                client_key=data["client_key"],
            )
        except decisions.SyncApplyInputError as exc:
            raise _input_error(exc) from exc
        if result.outcome != SyncApprovalOutcome.APPLIED:
            return _refusal(result, run)
        rejected = result.decided(SyncChangeState.REJECTED)
        payload = SyncDecisionResponseSerializer(
            {
                "decision_id": result.approval_id,
                "action": result.action,
                "outcome": result.outcome,
                "detail": _decision_detail(
                    action="reject",
                    count=len(rejected),
                    remaining=0,
                    decision_id=result.approval_id,
                ),
                "counts": _counts(result, rejected=rejected),
                "run": _run_payload(run),
            }
        )
        return Response(payload.data, status=status.HTTP_200_OK)

    @extend_schema(
        summary="Revert an applied decision",
        description="Write an applied decision's `before` values back, or list every blocker "
        "of the dry run (the default). A dry run answers 200 with `changes` or `blockers`; "
        "a write with a blocker answers 409. Reverting writes a new decision. "
        "Superusers only.",
        request=SyncRevertRequestSerializer,
        responses=R_SYNC_REVERT,
        operation_id="ukma_data_sync_revert",
    )
    def revert(self, request: Request) -> Response:
        data = self._body(SyncRevertRequestSerializer, request)
        result = decisions.revert(
            int(data["approval_id"]),
            request.user,
            dry_run=bool(data["dry_run"]),
        )
        payload = SyncRevertResponseSerializer(
            {
                "approval_id": result.original_id,
                "decision_id": result.approval_id,
                "dry_run": result.dry_run,
                "outcome": result.outcome,
                "code": result.error,
                "detail": _revert_detail(result),
                "changes": _revert_changes(result.change_ids),
                "blockers": [
                    {
                        "change_id": blocker.change_id,
                        "kind": blocker.kind,
                        "reason": blocker.reason,
                        "text": blocker.text,
                    }
                    for blocker in result.blockers
                ],
                "reverted": int(result.counts.get("reverted") or 0),
                "skipped": int(result.counts.get("skipped") or 0),
            }
        )
        if result.error == "unknown_approval":
            return Response(payload.data, status=status.HTTP_404_NOT_FOUND)
        if result.outcome == SyncApprovalOutcome.FAILED:
            return Response(payload.data, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        if result.outcome == SyncApprovalOutcome.REFUSED and not result.dry_run:
            return Response(payload.data, status=status.HTTP_409_CONFLICT)
        return Response(payload.data, status=status.HTTP_200_OK)

    @extend_schema(
        summary="Read the sync journal",
        description="Every apply, reject, revert, policy change and mapping answer, newest "
        "first, with whether an apply can be reverted. Page with `before`: pass the "
        "previous response's `next_before`. Superusers only.",
        parameters=to_openapi((SyncJournalParams, OpenApiParameter.QUERY)),
        responses=R_SYNC_JOURNAL,
        operation_id="ukma_data_sync_journal",
    )
    def journal(self, request: Request) -> Response:
        params = self._query(request, SyncJournalParams)
        entries = sync_journal.entries(limit=params.limit, before=_aware(params.before))
        next_before = entries[-1].when if len(entries) == params.limit else None
        payload = SyncJournalResponseSerializer({"items": entries, "next_before": next_before})
        return Response(payload.data, status=status.HTTP_200_OK)

    def _body(
        self, serializer_class: type[serializers.Serializer], request: Request
    ) -> dict[str, Any]:
        serializer = serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)
        return cast(dict[str, Any], serializer.validated_data)

    def _run(self, data: dict[str, Any]) -> SyncRun:
        run_id = data.get("run")
        if run_id is not None:
            run = SyncRun.objects.filter(pk=run_id).first()
            if run is None:
                raise NotFound("Запуск синхронізації не знайдено")
            return run
        run = decisions.current_run(str(data.get("source") or ""))
        if run is None:
            raise NotFound("Синхронізацію ще не запускали")
        return run

    def _selection(self, data: dict[str, Any], run: SyncRun) -> tuple[list[int], str, str]:
        given = cast(list[int] | None, data.get("change_ids"))
        if given:
            return list(dict.fromkeys(given)), "", ""
        group = str(data.get("group") or "")
        kind = str(data.get("kind") or "")
        ids = selection.filter_ids(run, str(run.source), {"group": group, "kind": kind})
        return ids, group, kind


def _input_error(exc: decisions.SyncApplyInputError) -> ValidationError:
    field = "token" if str(exc) == "unknown preview token" else "change_ids"
    return ValidationError({field: [decisions.input_error_text(exc)]})


def _refusal(result: decisions.DecisionResult, run: SyncRun) -> Response:
    code = result.error or "failed"
    if result.outcome == SyncApprovalOutcome.FAILED:
        code = "failed"
        http_status = status.HTTP_500_INTERNAL_SERVER_ERROR
        detail = "Не вдалося застосувати зміни. Перегляньте Журнал."
    else:
        http_status = REFUSAL_STATUS.get(code, status.HTTP_409_CONFLICT)
        detail = decisions.refusal_text(code, run)
    logger.info(
        "sync_decision_refused",
        code=code,
        approval_id=result.approval_id,
        run_id=run.pk,
    )
    payload = SyncRefusalSerializer(
        {
            "detail": detail,
            "code": code,
            "status": http_status,
            "decision_id": result.approval_id,
        }
    )
    return Response(payload.data, status=http_status)


def _counts(
    result: decisions.DecisionResult,
    *,
    applied: list[decisions.ChangeOutcome] | None = None,
    rejected: list[decisions.ChangeOutcome] | None = None,
) -> dict[str, Any]:
    done = [*(applied or []), *(rejected or [])]
    done_ids = {item.change.pk for item in done}
    waiting = [
        item
        for item in result.outcomes
        if item.change.pk not in done_ids and item.state == SyncChangeState.PROPOSED
    ]
    skipped = [
        item
        for item in result.outcomes
        if item.change.pk not in done_ids and item.state != SyncChangeState.PROPOSED
    ]
    return {
        "applied": len(applied or []),
        "rejected": len(rejected or []),
        "skipped": len(skipped),
        "waiting": len(waiting),
        "superseded": int(result.counts.get("superseded") or 0),
        "remaining": result.remaining,
        "total": len(result.outcomes),
        "by_kind": _by_kind([str(item.change.kind) for item in done]),
    }


def _by_kind(kinds: list[str]) -> list[dict[str, Any]]:
    counter = Counter(kinds)
    return [
        {"kind": kind.name, "count": counter[kind.name]} for kind in KINDS if counter[kind.name]
    ]


def _replay(client_key: Any) -> SyncApproval | None:
    """A repeated `client_key` returns the first decision, even when its changes
    are no longer proposed and the selection would resolve to nothing."""
    return SyncApproval.objects.filter(client_key=client_key).first()


def _replay_response(approval: SyncApproval) -> Response:
    run = _approval_run(approval)
    if approval.outcome != SyncApprovalOutcome.APPLIED:
        return _refusal(
            decisions.DecisionResult(
                action=str(approval.action),
                outcome=str(approval.outcome),
                dry_run=False,
                approval_id=approval.pk,
                error=str(approval.error or ""),
                counts=dict(approval.counts or {}),
                run_id=approval.run_ref,
            ),
            run,
        )
    counts = dict(approval.counts or {})
    action = str(approval.action)
    done_state = (
        (SyncChangeState.APPLIED, SyncChangeState.REVERTED)
        if action == "apply"
        else (SyncChangeState.REJECTED,)
    )
    kinds = list(
        SyncChange.objects.filter(approval=approval, state__in=done_state).values_list(
            "kind", flat=True
        )
    )
    applied = int(counts.get("applied") or 0)
    rejected = int(counts.get("rejected") or 0)
    remaining = int(counts.get("remaining") or 0)
    payload = SyncDecisionResponseSerializer(
        {
            "decision_id": approval.pk,
            "action": action,
            "outcome": approval.outcome,
            "detail": _decision_detail(
                action=action,
                count=applied if action == "apply" else rejected,
                remaining=remaining,
                decision_id=approval.pk,
            ),
            "counts": {
                "applied": applied,
                "rejected": rejected,
                "skipped": int(counts.get("skipped") or 0),
                "waiting": int(counts.get("waiting") or 0),
                "superseded": int(counts.get("superseded") or 0),
                "remaining": remaining,
                "total": len(approval.change_ids or []),
                "by_kind": _by_kind(kinds),
            },
            "run": _run_payload(run),
        }
    )
    return Response(payload.data, status=status.HTTP_200_OK)


def _approval_run(approval: SyncApproval) -> SyncRun:
    if approval.run is not None:
        return approval.run
    run = SyncRun.objects.filter(pk=approval.run_ref).first()
    if run is None:
        raise NotFound("Запуск синхронізації не знайдено")
    return run


def _left_out(
    result: decisions.DecisionResult, done: list[decisions.ChangeOutcome]
) -> tuple[list[decisions.ChangeOutcome], list[decisions.ChangeOutcome]]:
    done_ids = {item.change.pk for item in done}
    waiting: list[decisions.ChangeOutcome] = []
    skipped: list[decisions.ChangeOutcome] = []
    for item in result.outcomes:
        if item.change.pk in done_ids:
            continue
        if item.state == SyncChangeState.PROPOSED:
            waiting.append(item)
        else:
            skipped.append(item)
    return skipped, waiting


def _reason(item: decisions.ChangeOutcome) -> tuple[str, str]:
    change = item.change
    if item.state == SyncChangeState.SUPERSEDED:
        reason = str(item.state_reason or "superseded")
        return reason, text.STATE_REASON_TEXT.get(reason, "неактуальна")
    if item.state == SyncChangeState.REJECTED:
        return "rejected", "уже відхилена"
    if item.state == SyncChangeState.APPLIED:
        return "already_applied", "уже застосована"
    if item.state == SyncChangeState.REVERTED:
        return "reverted", "уже відкочена"
    if item.waiting_on:
        return "waiting_on", _WAITING_ON_TEXT
    if change.kind in MAPPING_KINDS:
        return "mapping_unanswered", _MAPPING_TEXT
    return "not_ready", _NOT_READY_TEXT


def _reasons(items: list[decisions.ChangeOutcome]) -> list[dict[str, Any]]:
    grouped: dict[tuple[str, str], int] = {}
    for item in items:
        key = _reason(item)
        grouped[key] = grouped.get(key, 0) + 1
    return [
        {"code": code, "text": reason, "count": count}
        for (code, reason), count in sorted(grouped.items(), key=lambda pair: -pair[1])
    ]


def _run_payload(run: SyncRun) -> dict[str, Any]:
    return {
        "id": run.pk,
        "source": run.source,
        "finished_at": run.finished_at,
        "data_updated_at": run.data_updated_at,
        "age_hours": decisions.age_hours(run),
    }


def _preview_detail(count: int) -> str:
    if not count:
        return "Нічого не буде застосовано."
    return f"Застосується {text.changes_accusative(count)}."


def _decision_detail(
    *,
    action: str,
    count: int,
    remaining: int,
    decision_id: int | None,
) -> str:
    head = (
        f"Відхилено {text.changes_accusative(count)}."
        if action == "reject"
        else f"Застосовано {text.changes_accusative(count)}."
    )
    if decision_id is not None:
        head += f" Рішення #{decision_id}."
    if action == "apply" and remaining:
        head += f" Ще {text.changes_word(remaining)} лишилося наступного разу."
    return head


def _revert_detail(result: Any) -> str:
    if result.blockers:
        count = len(result.blockers)
        verb = text.plural(count, "заважає", "заважають", "заважають")
        return (
            f"Не можна відкотити рішення #{result.original_id}: {text.changes_word(count)} {verb}."
        )
    if result.outcome == SyncApprovalOutcome.APPLIED and result.dry_run:
        return f"Відкотило б {text.changes_accusative(len(result.change_ids))}."
    if result.outcome == SyncApprovalOutcome.APPLIED:
        return (
            f"Відкочено. Рішення #{result.approval_id}. Зміни повернуться в "
            "«Чекають рішення» після наступного читання."
        )
    if result.outcome == SyncApprovalOutcome.FAILED:
        return "Не вдалося відкотити рішення. Перегляньте Журнал."
    return result.refusal_text()


def _revert_changes(change_ids: list[int]) -> list[dict[str, Any]]:
    if not change_ids:
        return []
    kinds = dict(SyncChange.objects.filter(pk__in=change_ids).values_list("pk", "kind"))
    return [
        {"id": change_id, "kind": kinds[change_id]}
        for change_id in change_ids
        if change_id in kinds
    ]


def _aware(value: datetime | None) -> datetime | None:
    if value is None or timezone.is_aware(value):
        return value
    return timezone.make_aware(value, timezone.get_default_timezone())
