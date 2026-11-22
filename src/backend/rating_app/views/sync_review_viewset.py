"""Review endpoints of the sync section: the numbered path, questions and history."""

from __future__ import annotations

import csv
import io
from typing import Any

from django.http import HttpResponse
from rest_framework import status
from rest_framework.exceptions import NotFound
from rest_framework.request import Request
from rest_framework.response import Response

import structlog
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema

from rating_app.application_schemas.sync import (
    SyncListParams,
    SyncQuestionListParams,
    SyncRunChangesPathParams,
    SyncSummaryParams,
)
from rating_app.ioc_container.common import pydantic_to_openapi_request_mapper
from rating_app.models.sync import (
    SyncApproval,
    SyncChange,
    SyncChangeState,
    SyncRun,
)
from rating_app.serializers.sync_review import (
    SyncApprovalListResponseSerializer,
    SyncQuestionListResponseSerializer,
    SyncSummarySerializer,
)
from rating_app.sync import questions, review
from rating_app.views.responses import (
    R_SYNC_APPROVALS,
    R_SYNC_QUESTIONS,
    R_SYNC_SUMMARY,
)
from rating_app.views.sync_base import SyncViewSetBase

logger = structlog.get_logger(__name__)
to_openapi = pydantic_to_openapi_request_mapper().map


@extend_schema(tags=["ukma-data"])
class SyncReviewViewSet(SyncViewSetBase):
    """The review screen: one run's path, its questions, previews and approvals."""

    @extend_schema(
        summary="Review summary of one sync run",
        description="The numbered work path of /data/sync: counts, rated rows, ratings, "
        "plans, waiting units and facets per step, plus the staff's live answers and "
        "what the builder could not propose. Superusers only.",
        parameters=to_openapi((SyncSummaryParams, OpenApiParameter.QUERY)),
        responses=R_SYNC_SUMMARY,
        operation_id="ukma_data_sync_summary",
    )
    def summary(self, request: Request) -> Response:
        params = self._query(request, SyncSummaryParams)
        run = self._request_run(params.source, params.run)
        payload = SyncSummarySerializer(review.summary_payload(run))
        return Response(payload.data, status=status.HTTP_200_OK)

    @extend_schema(
        summary="List mapping questions",
        description="The run's mapping questions in answer order: unanswered first, then "
        "most ratings, narrowed by `kinds`, `rated` and a title `q`. Each course carries "
        "its live ratings, plans and offerings; the САЗ title and department, the "
        "semester a placement or move is about, a suggested merge target (the page with "
        "ratings, then the one whose department is as in САЗ) and the live answer are "
        "included. Superusers only.",
        parameters=to_openapi((SyncQuestionListParams, OpenApiParameter.QUERY)),
        responses=R_SYNC_QUESTIONS,
        operation_id="ukma_data_sync_questions_list",
    )
    def questions(self, request: Request) -> Response:
        params = self._query(request, SyncQuestionListParams)
        run = self._request_run(params.source, params.run)
        items, next_after = questions.page(
            run,
            rated=params.rated,
            after=params.after,
            limit=params.limit,
            kinds=frozenset((params.kinds or "").split(",")) - {""},
            q=params.q,
        )
        payload = SyncQuestionListResponseSerializer(
            {"items": [questions.payload(item) for item in items], "next_after": next_after}
        )
        return Response(payload.data, status=status.HTTP_200_OK)

    @extend_schema(
        summary="List one run's approvals",
        description="Who applied or rejected what, when, with the selection in words, the "
        "counts and what moved. Superusers only.",
        parameters=[
            *to_openapi((SyncRunChangesPathParams, OpenApiParameter.PATH)),
            *to_openapi((SyncListParams, OpenApiParameter.QUERY)),
        ],
        responses=R_SYNC_APPROVALS,
        operation_id="ukma_data_sync_run_approvals_list",
    )
    def run_approvals(self, request: Request, run_id: str | None = None) -> Response:
        path = self._validated(SyncRunChangesPathParams, {"run_id": run_id})
        if not SyncRun.objects.filter(pk=path.run_id).exists():
            raise NotFound("Sync run not found")
        params = self._query(request, SyncListParams)
        queryset = (
            SyncApproval.objects.filter(run_ref=path.run_id)
            .select_related("user")
            .order_by("-created_at", "-id")
        )
        page = self._paginate(queryset, params)
        payload = SyncApprovalListResponseSerializer(
            {
                "items": self._approval_details(list(page.page_objects)),
                **page.metadata.model_dump(),
            }
        )
        return Response(payload.data, status=status.HTTP_200_OK)

    @extend_schema(
        summary="Download one run's approvals and applied changes",
        description="CSV of the run's approvals and applied changes: kind, key, target, "
        "approval, user email and time. UTF-8 with a BOM. Superusers only.",
        parameters=to_openapi((SyncRunChangesPathParams, OpenApiParameter.PATH)),
        responses={(200, "text/csv"): OpenApiResponse(description="CSV export")},
        operation_id="ukma_data_sync_run_export",
    )
    def run_export(self, request: Request, run_id: str | None = None) -> HttpResponse:
        path = self._validated(SyncRunChangesPathParams, {"run_id": run_id})
        if not SyncRun.objects.filter(pk=path.run_id).exists():
            raise NotFound("Sync run not found")
        buffer = io.StringIO()
        writer = csv.writer(buffer)
        writer.writerow(["type", "kind", "key", "target_id", "approval_id", "user_email", "time"])
        approvals = list(
            SyncApproval.objects.filter(run_ref=path.run_id)
            .select_related("user")
            .order_by("created_at", "id")
        )
        changes = list(
            SyncChange.objects.filter(run_id=path.run_id, state=SyncChangeState.APPLIED)
            .select_related("approval__user")
            .order_by("decided_at", "id")
        )
        rows: list[tuple[str, list[Any]]] = [
            (
                str(approval.created_at),
                [
                    "approval",
                    approval.kind or approval.group,
                    "",
                    "",
                    approval.pk,
                    approval.user.email if approval.user is not None else "",
                    approval.created_at.isoformat(),
                ],
            )
            for approval in approvals
        ]
        rows.extend(
            (
                str(change.decided_at),
                [
                    "change",
                    change.kind,
                    change.key,
                    change.target_id or "",
                    change.approval_id or "",
                    change.approval.user.email
                    if change.approval is not None and change.approval.user is not None
                    else "",
                    change.decided_at.isoformat() if change.decided_at else "",
                ],
            )
            for change in changes
        )
        for _, row in sorted(rows, key=lambda item: item[0]):
            writer.writerow([_csv_cell(value) for value in row])
        response = HttpResponse(
            "\ufeff" + buffer.getvalue(), content_type="text/csv; charset=utf-8"
        )
        response["Content-Disposition"] = f'attachment; filename="sync-run-{path.run_id}.csv"'
        return response


_FORMULA_PREFIXES = ("=", "+", "-", "@", "\t", "\r")


def _csv_cell(value: Any) -> Any:
    """Keys come from UKMA Data: a cell a spreadsheet would run as a formula is
    prefixed with an apostrophe so it opens as text."""
    if isinstance(value, str) and value.startswith(_FORMULA_PREFIXES):
        return "'" + value
    return value
