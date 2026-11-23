"""Shared machinery of the sync endpoints: pagination, validation and the
approval history. Decisions are made in the console (`manage.py catalog_sync`) or
on /data, through `rating_app.sync.decisions`.
"""

from __future__ import annotations

from collections import defaultdict
from typing import Any

from django.db.models import Model, QuerySet
from rest_framework import viewsets
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request

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
    SyncChange,
    SyncChangeState,
    SyncRun,
)
from rating_app.pagination.paginator import GenericQuerysetPaginator
from rating_app.sync import decisions, review
from rating_app.views.ukma_data_viewset import IsSuperuser

logger = structlog.get_logger(__name__)


class SyncViewSetBase(viewsets.ViewSet):
    permission_classes = [IsAuthenticated, IsSuperuser]

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

    def _request_run(self, source: str, run_id: int | None) -> SyncRun:
        if run_id is not None:
            run = SyncRun.objects.filter(pk=run_id).first()
            if run is None:
                raise NotFound("Запуск синхронізації не знайдено")
            return run
        run = decisions.current_run(source)
        if run is None:
            raise NotFound("Синхронізацію ще не запускали")
        return run

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
