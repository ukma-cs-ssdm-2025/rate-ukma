"""Shared machinery of the sync endpoints: pagination, validation, previews.

Both the review viewset (summary, questions, history) and the action viewset
(approve, reject, policies) read selections and describe approvals the same
way, so those helpers live here.
"""

from __future__ import annotations

from collections import Counter, defaultdict
from typing import Any

from django.db import transaction
from django.db.models import Model, QuerySet
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response

import structlog
from pydantic import BaseModel
from pydantic import ValidationError as ModelValidationError

from rating_app.application_schemas.pagination import (
    PaginationFilters,
    PaginationMetadata,
    QuerySetPaginationResult,
)
from rating_app.application_schemas.sync import SyncListParams, SyncPendingParams
from rating_app.models.sync import (
    SyncApproval,
    SyncApprovalOutcome,
    SyncChange,
    SyncChangeState,
    SyncRun,
    SyncRunStatus,
    SyncSource,
)
from rating_app.pagination.paginator import GenericQuerysetPaginator
from rating_app.sync import apply, review, selection
from rating_app.sync.apply import SyncApplyInputError
from rating_app.views.ukma_data_viewset import IsSuperuser

logger = structlog.get_logger(__name__)

INPUT_ERROR_TEXT = {
    "no change ids": "Не вибрано жодної зміни",
    "unknown change ids": "Деяких вибраних змін не існує",
    "changes from several runs": "Вибрані зміни належать різним запускам",
}


def input_error_text(exc: SyncApplyInputError) -> str:
    return INPUT_ERROR_TEXT.get(str(exc), "Некоректна вибірка змін")


class SyncViewSetBase(viewsets.ViewSet):
    permission_classes = [IsAuthenticated, IsSuperuser]

    def _selection_ids(
        self, selection_data: dict[str, Any], run: SyncRun, source: SyncSource
    ) -> list[int]:
        given = selection_data.get("change_ids")
        if given is not None:
            ids = [int(change_id) for change_id in given]
            found = set(
                SyncChange.objects.filter(pk__in=set(ids), run=run, source=source).values_list(
                    "id", flat=True
                )
            )
            if len(found) != len(set(ids)):
                raise ValidationError({"selection": ["Деяких вибраних змін не існує"]})
            return sorted(int(change_id) for change_id in found)
        filters = selection_data.get("filter") or {}
        return selection.filter_ids(run, source, filters)

    def _dry_run(
        self, run: SyncRun, ids: list[int], user: Any
    ) -> tuple[dict[str, dict[str, int]], dict[str, int], int, int] | Response:
        del run
        try:
            with transaction.atomic():
                approval = apply.approve(ids, user, confirm_old_run=True)
                if approval.outcome == SyncApprovalOutcome.REFUSED:
                    transaction.set_rollback(True)
                    return self._refusal(approval, user)
                if approval.outcome == SyncApprovalOutcome.FAILED:
                    transaction.set_rollback(True)
                    return Response(
                        {
                            "detail": "Не вдалося застосувати зміни",
                            "error": approval.error,
                            "status": status.HTTP_500_INTERNAL_SERVER_ERROR,
                        },
                        status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    )
                rows = list(
                    SyncChange.objects.filter(pk__in=approval.change_ids).values(
                        "kind", "state", "state_reason"
                    )
                )
                moved = list(
                    SyncChange.objects.filter(
                        pk__in=approval.change_ids,
                        state=SyncChangeState.APPLIED,
                        kind__in=["merge_courses", "move_offering"],
                    )
                )
                ratings, plans = review.moved_counts(moved)
                counts, reasons = self._preview_counts(rows)
                transaction.set_rollback(True)
        except SyncApplyInputError as exc:
            raise ValidationError({"change_ids": [input_error_text(exc)]}) from exc
        return counts, reasons, ratings, plans

    def _preview_counts(
        self, rows: list[dict[str, Any]]
    ) -> tuple[dict[str, dict[str, int]], dict[str, int]]:
        counts: dict[str, dict[str, int]] = {}
        reasons: Counter[str] = Counter()
        for row in rows:
            kind = str(row["kind"])
            entry = counts.setdefault(kind, {"apply": 0, "wait": 0, "superseded": 0})
            state = row["state"]
            if state == SyncChangeState.APPLIED:
                entry["apply"] += 1
            elif state == SyncChangeState.SUPERSEDED:
                entry["superseded"] += 1
                reasons[str(row["state_reason"])] += 1
            else:
                entry["wait"] += 1
        return counts, dict(reasons)

    def _sample_page(
        self, ids: list[int], params: SyncPendingParams
    ) -> tuple[list[SyncChange], dict[str, Any]]:
        page_size = params.page_size or 20
        total = len(ids)
        total_pages = (total + page_size - 1) // page_size if total else 0
        page = min(params.page or 1, total_pages) if total_pages else 1
        start = (page - 1) * page_size
        page_ids = ids[start : start + page_size]
        by_id = {change.pk: change for change in SyncChange.objects.filter(pk__in=page_ids)}
        ordered = [by_id[change_id] for change_id in page_ids if change_id in by_id]
        metadata = PaginationMetadata(
            page=page,
            page_size=page_size,
            total=total,
            total_pages=total_pages,
        )
        return ordered, metadata.model_dump()

    def _approval_details(self, approvals: list[SyncApproval]) -> list[dict[str, Any]]:
        ids = [approval.pk for approval in approvals]
        applied = list(
            SyncChange.objects.filter(
                approval_id__in=ids,
                state=SyncChangeState.APPLIED,
                kind__in=["merge_courses", "move_offering"],
            )
        )
        by_approval: dict[int, list[SyncChange]] = defaultdict(list)
        for change in applied:
            if change.approval_id is not None:
                by_approval[change.approval_id].append(change)
        details = []
        for approval in approvals:
            changes = by_approval.get(approval.pk, [])
            ratings, plans = review.moved_counts(changes)
            details.append(
                {
                    "id": approval.pk,
                    "run_id": approval.run_ref,
                    "action": approval.action,
                    "scope": approval.scope,
                    "group": approval.group,
                    "kind": approval.kind,
                    "outcome": approval.outcome,
                    "counts": approval.counts,
                    "error": approval.error,
                    "user_email": approval.user.email if approval.user is not None else None,
                    "created_at": approval.created_at,
                    "selection": review.selection_description(approval),
                    "ratings_moved": ratings,
                    "plans_moved": plans,
                    "merged": review.merged_courses(changes),
                }
            )
        return details

    def _approval_detail(self, approval: SyncApproval) -> dict[str, Any]:
        return self._approval_details([approval])[0]

    def _request_run(self, source: SyncSource, run_id: int | None) -> SyncRun:
        if run_id is not None:
            run = SyncRun.objects.filter(pk=run_id).first()
            if run is None:
                raise NotFound("Запуск синхронізації не знайдено")
            return run
        run = (
            SyncRun.objects.filter(source=source, status=SyncRunStatus.SUCCEEDED)
            .order_by("-finished_at", "-id")
            .first()
        )
        if run is None:
            raise NotFound("Синхронізацію ще не запускали")
        return run

    def _refusal(self, approval: SyncApproval, user: Any) -> Response:
        reason = approval.error
        if reason == "lock_held":
            detail = "Синхронізація саме триває"
            code = status.HTTP_409_CONFLICT
        elif reason == "run_too_old":
            detail = "Дані старші за 48 год"
            hours = self._run_age_hours(approval)
            if hours is not None:
                detail = f"{detail} ({hours} год)"
            code = status.HTTP_409_CONFLICT
        elif reason == "run_not_current":
            detail = "Запуск синхронізації вже не актуальний"
            code = status.HTTP_409_CONFLICT
        elif reason == "no_proposed_changes":
            detail = "Немає запропонованих змін для цієї вибірки"
            code = status.HTTP_400_BAD_REQUEST
        else:
            detail = reason or "Не вдалося виконати дію"
            code = status.HTTP_400_BAD_REQUEST
        body: dict[str, Any] = {"detail": detail, "status": code}
        if code == status.HTTP_409_CONFLICT:
            body["holder"] = self._holder(user, lock_held=reason == "lock_held")
            body["run_age_hours"] = self._run_age_hours(approval)
        return Response(body, status=code)

    def _run_age_hours(self, approval: SyncApproval) -> int | None:
        run = approval.run
        return None if run is None else self._age_hours(run)

    def _age_hours(self, run: SyncRun) -> int | None:
        stamps = [stamp for stamp in (run.finished_at, run.data_updated_at) if stamp is not None]
        if not stamps:
            return None
        return int((timezone.now() - min(stamps)).total_seconds() // 3600)

    def _holder(self, user: Any, *, lock_held: bool) -> str:
        newest = (
            SyncApproval.objects.filter(outcome=SyncApprovalOutcome.STARTED)
            .order_by("-created_at", "-id")
            .first()
        )
        if lock_held and (newest is None or newest.user_id is None):
            return "nightly"
        if newest is not None and newest.user_id == user.pk:
            return "self"
        return "other_user"

    def _paginate[TModel: Model](
        self, queryset: QuerySet[TModel], params: SyncListParams
    ) -> QuerySetPaginationResult[TModel]:
        paginator = GenericQuerysetPaginator[TModel]()
        return paginator.process(
            queryset,
            PaginationFilters(page=params.page, page_size=params.page_size),
        )

    def _query[M: BaseModel](self, request: Request, model: type[M]) -> M:
        return self._validated(model, request.query_params.dict())

    def _validated[M: BaseModel](self, model: type[M], data: dict[str, Any]) -> M:
        try:
            return model.model_validate(data)
        except ModelValidationError as e:
            errors = e.errors(include_input=False, include_url=False)
            logger.error("validation_error", errors=errors)
            field_errors: dict[str, list[str]] = {}
            for error in errors:
                field = str(error["loc"][0]) if error["loc"] else "non_field_errors"
                field_errors.setdefault(field, []).append(error["msg"])
            raise ValidationError(detail=field_errors) from e
