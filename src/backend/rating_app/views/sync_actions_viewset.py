"""Superuser endpoints that decide sync changes: preview, apply, reject, revert
and the journal. Every decision goes through `rating_app.sync.decisions` and the
journal reads `rating_app.sync.journal`, so the console and the UI take one path.
"""

from __future__ import annotations

from collections import Counter
from typing import Any, cast

from rest_framework import serializers, status
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.request import Request
from rest_framework.response import Response

import structlog
from drf_spectacular.utils import OpenApiParameter, extend_schema

from rating_app.application_schemas.sync import SyncJournalParams
from rating_app.ioc_container.common import pydantic_to_openapi_request_mapper
from rating_app.models.sync import SyncChange, SyncRun
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
    "in_progress": status.HTTP_409_CONFLICT,
    "deadline_exceeded": status.HTTP_422_UNPROCESSABLE_ENTITY,
    "no_proposed_changes": status.HTTP_422_UNPROCESSABLE_ENTITY,
}

INPUT_FIELDS = {"unknown preview token": "token", "client key conflict": "client_key"}


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
        run = self._request_run(_source(data), data.get("run"))
        ids, group, kind = self._selection(data, run)
        if not ids:
            return _refusal("no_proposed_changes", decisions.run_info(run))
        try:
            preview = decisions.preview(
                ids,
                request.user,
                group=group,
                kind=kind,
                excluded=selection.excluded_ids(data),
                max_changes=MAX_CHANGES,
            )
        except decisions.SyncApplyInputError as exc:
            raise _input_error(exc) from exc
        result = preview.result
        if result.outcome != "applied":
            return _result_refusal(result)
        applied, waiting, skipped = _split(result)
        payload = SyncPreviewResponseSerializer(
            {
                "token": preview.token,
                "detail": _preview_detail(len(applied)),
                "counts": _counts(result, applied, waiting, skipped),
                "skipped_reasons": _reasons(skipped),
                "waiting_reasons": _reasons(waiting),
                "run": _run_payload(_require_run(result)),
            }
        )
        return Response(payload.data, status=status.HTTP_200_OK)

    @extend_schema(
        summary="Apply a previewed sync selection",
        description="Apply at most 5 000 changes of the previewed selection, lowest change "
        "numbers first, in one transaction. The 40 s budget starts once the selection is "
        "read and is checked between batches and before the decision is saved; past it no "
        "change is written, the refused decision is kept for the Журнал, and the answer is "
        "422 `deadline_exceeded`. One SQL statement may run at most 30 s; a statement cut "
        "there answers 500 `failed`, and a batch started near the end can finish after "
        "40 s. The `token` "
        "from `preview` binds the selected change ids: if that id set changed, the answer "
        "is 409 `selection_changed`. A change in the set that another decision took since "
        "the preview is not applied and is counted as skipped, so `counts` can differ from "
        "the preview. A retry with the same `client_key` never applies twice: it returns "
        "the first decision with its own status (200 when it applied, the same refusal "
        "when it was refused) or 409 `in_progress` while it still runs. Each new attempt "
        "needs a new `client_key`. Superusers only.",
        request=SyncApplyRequestSerializer,
        responses=R_SYNC_APPLY,
        operation_id="ukma_data_sync_apply",
    )
    def apply(self, request: Request) -> Response:
        data = self._body(SyncApplyRequestSerializer, request)
        replayed = decisions.replay(data["client_key"], request.user, "apply")
        if replayed is not None:
            return _decision_response(replayed)
        run = self._request_run(_source(data), data.get("run"))
        ids, group, kind = self._selection(data, run)
        if not ids:
            return _replay_or_refusal(data, request, "apply", "selection_changed", run)
        try:
            result = decisions.approve(
                ids,
                request.user,
                dry_run=False,
                group=group,
                kind=kind,
                excluded=selection.excluded_ids(data),
                client_key=data["client_key"],
                max_changes=MAX_CHANGES,
                deadline_seconds=DEADLINE_SECONDS,
                preview_token=str(data["token"]),
            )
        except decisions.SyncApplyInputError as exc:
            raise _input_error(exc) from exc
        return _decision_response(result)

    @extend_schema(
        summary="Reject a sync selection",
        description="Mark the selected proposed changes of one run rejected and supersede the "
        "changes waiting on them; nothing on the site changes. A rejected change comes back "
        "after the next read if САЗ still differs. A retry with the same `client_key` "
        "returns the first decision with its own status (200 when it rejected, the same "
        "refusal when it was refused) or 409 `in_progress` while it still runs. Each new "
        "attempt needs a new `client_key`. Superusers only.",
        request=SyncRejectRequestSerializer,
        responses=R_SYNC_REJECT,
        operation_id="ukma_data_sync_reject",
    )
    def reject(self, request: Request) -> Response:
        data = self._body(SyncRejectRequestSerializer, request)
        replayed = decisions.replay(data["client_key"], request.user, "reject")
        if replayed is not None:
            return _decision_response(replayed)
        run = self._request_run(_source(data), data.get("run"))
        ids, _, _ = self._selection(data, run)
        if not ids:
            return _replay_or_refusal(data, request, "reject", "no_proposed_changes", run)
        try:
            result = decisions.reject(
                ids,
                request.user,
                dry_run=False,
                client_key=data["client_key"],
            )
        except decisions.SyncApplyInputError as exc:
            raise _input_error(exc) from exc
        return _decision_response(result)

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
                "code": result.error or None,
                "detail": _revert_detail(result),
                "changes": decisions.change_kinds(result.change_ids),
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
        if result.outcome == "failed":
            return Response(payload.data, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        if result.outcome == "refused" and not result.dry_run:
            return Response(payload.data, status=status.HTTP_409_CONFLICT)
        return Response(payload.data, status=status.HTTP_200_OK)

    @extend_schema(
        summary="Read the sync journal",
        description="Every apply, reject, revert, policy change and mapping answer, newest "
        "first, with whether an apply can be reverted. Page with `before`: pass the "
        "previous response's `next_before` unchanged. Superusers only.",
        parameters=to_openapi((SyncJournalParams, OpenApiParameter.QUERY)),
        responses=R_SYNC_JOURNAL,
        operation_id="ukma_data_sync_journal",
    )
    def journal(self, request: Request) -> Response:
        params = self._query(request, SyncJournalParams)
        cursor = sync_journal.parse_cursor(params.before) if params.before else None
        if params.before and cursor is None:
            raise ValidationError({"before": ["Невірний курсор"]})
        entries = sync_journal.entries(limit=params.limit, before=cursor)
        next_before = sync_journal.cursor_of(entries[-1]) if len(entries) == params.limit else None
        payload = SyncJournalResponseSerializer({"items": entries, "next_before": next_before})
        return Response(payload.data, status=status.HTTP_200_OK)

    def _body(
        self, serializer_class: type[serializers.Serializer], request: Request
    ) -> dict[str, Any]:
        serializer = serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)
        return cast(dict[str, Any], serializer.validated_data)

    def _selection(self, data: dict[str, Any], run: SyncRun) -> tuple[list[int], str, str]:
        given = cast(list[int] | None, data.get("change_ids"))
        if given:
            ids = list(dict.fromkeys(given))
            if data.get("run") is not None and _outside_run(ids, run):
                raise ValidationError({"change_ids": ["Зміни мають бути з цього запуску"]})
            return ids, "", ""
        group = str(data.get("group") or "")
        kind = str(data.get("kind") or "")
        filters = {
            "group": group,
            "kind": kind,
            "rated": data.get("rated"),
            "match": data.get("match"),
            "changed_field": data.get("changed_field"),
            "quiet": data.get("quiet"),
            "q": data.get("q"),
            "year_from": data.get("year_from"),
            "year_to": data.get("year_to"),
            "exclude_ids": data.get("exclude_ids") or [],
        }
        ids = selection.filter_ids(run, str(run.source), filters)
        return ids, group, kind


def _replay_or_refusal(
    data: dict[str, Any], request: Request, action: str, code: str, run: SyncRun
) -> Response:
    """An empty selection may mean this key's first request has just decided it."""
    replayed = decisions.replay(data["client_key"], request.user, action)
    if replayed is not None:
        return _decision_response(replayed)
    return _refusal(code, decisions.run_info(run))


def _outside_run(ids: list[int], run: SyncRun) -> bool:
    return SyncChange.objects.filter(pk__in=ids).exclude(run=run).exists()


def _source(data: dict[str, Any]) -> str:
    return str(data.get("source") or "catalog")


def _input_error(exc: decisions.SyncApplyInputError) -> ValidationError:
    field = INPUT_FIELDS.get(exc.code, "change_ids")
    return ValidationError({field: [decisions.input_error_text(exc)]})


def _decision_response(result: decisions.DecisionResult) -> Response:
    if result.outcome != "applied":
        return _result_refusal(result)
    done, waiting, skipped = _split(result)
    payload = SyncDecisionResponseSerializer(
        {
            "decision_id": result.approval_id,
            "action": result.action,
            "outcome": result.outcome,
            "detail": _decision_detail(result, len(done)),
            "counts": _counts(result, done, waiting, skipped),
            "run": _run_payload(_require_run(result)),
        }
    )
    return Response(payload.data, status=status.HTTP_200_OK)


def _result_refusal(result: decisions.DecisionResult) -> Response:
    code = "failed" if result.outcome == "failed" else result.error or "failed"
    if result.outcome == "started":
        code = "in_progress"
    return _refusal(code, _require_run(result), decision_id=result.approval_id)


def _refusal(code: str, run: decisions.RunInfo, *, decision_id: int | None = None) -> Response:
    if code == "failed":
        http_status = status.HTTP_500_INTERNAL_SERVER_ERROR
        detail = "Не вдалося застосувати зміни. Перегляньте Журнал."
    else:
        http_status = REFUSAL_STATUS.get(code, status.HTTP_409_CONFLICT)
        detail = decisions.api_refusal_text(code)
    logger.info("sync_decision_refused", code=code, decision_id=decision_id, run_id=run.id)
    payload = SyncRefusalSerializer(
        {
            "detail": detail,
            "code": code,
            "status": http_status,
            "decision_id": decision_id,
        }
    )
    return Response(payload.data, status=http_status)


def _require_run(result: decisions.DecisionResult) -> decisions.RunInfo:
    if result.run is None:
        raise NotFound("Запуск синхронізації не знайдено")
    return result.run


def _split(
    result: decisions.DecisionResult,
) -> tuple[
    list[decisions.ChangeOutcome],
    list[decisions.ChangeOutcome],
    list[decisions.ChangeOutcome],
]:
    done_states = ("rejected",) if result.action == "reject" else ("applied", "reverted")
    done = [item for item in result.outcomes if item.decided_now and item.state in done_states]
    done_ids = {item.change.pk for item in done}
    left = [item for item in result.outcomes if item.change.pk not in done_ids]
    waiting = [item for item in left if item.state == "proposed"]
    skipped = [item for item in left if item.state != "proposed"]
    return done, waiting, skipped


def _counts(
    result: decisions.DecisionResult,
    done: list[decisions.ChangeOutcome],
    waiting: list[decisions.ChangeOutcome],
    skipped: list[decisions.ChangeOutcome],
) -> dict[str, Any]:
    return {
        "applied": len(done) if result.action == "apply" else 0,
        "rejected": len(done) if result.action == "reject" else 0,
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


def _reasons(items: list[decisions.ChangeOutcome]) -> list[dict[str, Any]]:
    grouped: dict[tuple[str, str], int] = {}
    for item in items:
        key = text.left_reason(item)
        grouped[key] = grouped.get(key, 0) + 1
    return [
        {"code": code, "text": reason, "count": count}
        for (code, reason), count in sorted(grouped.items(), key=lambda pair: -pair[1])
    ]


def _run_payload(run: decisions.RunInfo) -> dict[str, Any]:
    return {
        "id": run.id,
        "source": run.source,
        "finished_at": run.finished_at,
        "data_updated_at": run.data_updated_at,
        "age_hours": run.age_hours,
    }


def _preview_detail(count: int) -> str:
    if not count:
        return "Нічого не буде застосовано."
    return f"Застосується {text.changes_accusative(count)}."


def _decision_detail(result: decisions.DecisionResult, count: int) -> str:
    head = (
        f"Відхилено {text.changes_accusative(count)}."
        if result.action == "reject"
        else f"Застосовано {text.changes_accusative(count)}."
    )
    if result.approval_id is not None:
        head += f" Рішення #{result.approval_id}."
    if result.action == "apply" and result.remaining:
        head += f" Ще {text.changes_word(result.remaining)} лишилося наступного разу."
    return head


def _revert_detail(result: Any) -> str:
    if result.blockers:
        count = len(result.blockers)
        verb = text.plural(count, "заважає", "заважають", "заважають")
        return (
            f"Не можна відкотити рішення #{result.original_id}: {text.changes_word(count)} {verb}."
        )
    if result.outcome == "applied" and result.dry_run:
        return f"Відкотило б {text.changes_accusative(len(result.change_ids))}."
    if result.outcome == "applied":
        return (
            f"Відкочено. Рішення #{result.approval_id}. Зміни повернуться в "
            "«Чекають рішення» після наступного читання."
        )
    if result.outcome == "failed":
        return "Не вдалося відкотити рішення. Перегляньте Журнал."
    return result.refusal_text()
