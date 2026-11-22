from __future__ import annotations

from typing import Any, cast

from django.db.models import Count, Model, QuerySet
from rest_framework import status, viewsets
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response

import structlog
from drf_spectacular.utils import OpenApiParameter, extend_schema
from pydantic import BaseModel
from pydantic import ValidationError as ModelValidationError

from rating_app.application_schemas.pagination import (
    PaginationFilters,
    QuerySetPaginationResult,
)
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
    SyncRunStatus,
    SyncSource,
)
from rating_app.pagination.paginator import GenericQuerysetPaginator
from rating_app.serializers.sync import (
    SyncChangeListResponseSerializer,
    SyncPendingResponseSerializer,
    SyncPolicyChangeListResponseSerializer,
    SyncPolicyListResponseSerializer,
    SyncPolicySerializer,
    SyncPolicyUpdateSerializer,
    SyncRunListResponseSerializer,
)
from rating_app.sync.kinds import KIND_BY_NAME, KINDS, NEVER_AUTO_KINDS, SyncKind
from rating_app.sync.policies import set_mode
from rating_app.views.responses import (
    R_SYNC_CHANGES,
    R_SYNC_PENDING,
    R_SYNC_POLICIES,
    R_SYNC_POLICY,
    R_SYNC_POLICY_CHANGES,
    R_SYNC_RUNS,
)
from rating_app.views.ukma_data_viewset import IsSuperuser

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
class SyncViewSet(viewsets.ViewSet):
    """Runs, changes and policies of the syncs from UKMA Data, for /data."""

    permission_classes = [IsAuthenticated, IsSuperuser]

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
        description="Proposed changes of each source's current (latest succeeded) run, "
        "rated rows first. `groups` and `kinds` count every waiting change before the "
        "group and kind filters. Superusers only.",
        parameters=to_openapi((SyncPendingParams, OpenApiParameter.QUERY)),
        responses=R_SYNC_PENDING,
        operation_id="ukma_data_sync_pending_list",
    )
    def pending(self, request: Request) -> Response:
        params = self._query(request, SyncPendingParams)
        runs = self._current_runs(params.source)
        state = params.state or SyncChangeState.PROPOSED
        base = SyncChange.objects.filter(run_id__in=[run.id for run in runs], state=state)

        changes = self._filter_changes(base, params)
        page = self._paginate(changes, params)
        payload = SyncPendingResponseSerializer(
            {
                "items": page.page_objects,
                "groups": _counts_by(base, "group"),
                "kinds": _counts_by(base, "kind"),
                "runs": runs,
                **page.metadata.model_dump(),
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
