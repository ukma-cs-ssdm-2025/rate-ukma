from __future__ import annotations

from typing import Any

from django.db.models import Count, QuerySet
from rest_framework import status
from rest_framework.exceptions import NotFound
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
    SyncChange,
    SyncChangeState,
    SyncPolicy,
    SyncPolicyChange,
    SyncPolicyMode,
    SyncRun,
)
from rating_app.serializers.sync import (
    SyncChangeListResponseSerializer,
    SyncPendingResponseSerializer,
    SyncPolicyChangeListResponseSerializer,
    SyncPolicyListResponseSerializer,
    SyncRunListResponseSerializer,
)
from rating_app.sync import decisions, review, selection, view
from rating_app.sync.kinds import KINDS, NEVER_AUTO_KINDS, SyncKind
from rating_app.views.responses import (
    R_SYNC_CHANGES,
    R_SYNC_PENDING,
    R_SYNC_POLICIES,
    R_SYNC_POLICY_CHANGES,
    R_SYNC_RUNS,
)
from rating_app.views.sync_base import SyncViewSetBase

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
            runs = decisions.current_runs(params.source)
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
        changes = selection.narrow(
            changes,
            changed_field=None,
            blanks=params.blanks,
            year_from=params.year_from,
            year_to=params.year_to,
        )
        field_counts = view.field_counts(changes)
        if params.changed_field is not None:
            changes = selection.narrow(
                changes,
                changed_field=params.changed_field,
                blanks=None,
                year_from=None,
                year_to=None,
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
                "changed_fields": field_counts,
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

    def _filter_changes(
        self, queryset: QuerySet[SyncChange], params: SyncChangeListParams
    ) -> QuerySet[SyncChange]:
        if params.group is not None:
            queryset = review.in_group(queryset, str(params.group))
        if params.kind is not None:
            queryset = queryset.filter(kind=params.kind)
        if params.state is not None:
            queryset = queryset.filter(state=params.state)
        if params.approval is not None:
            queryset = queryset.filter(approval_id=params.approval)
        return queryset.order_by("-ratings", "id")
