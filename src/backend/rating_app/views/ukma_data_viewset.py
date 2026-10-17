from rest_framework import status, viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response

import structlog
from drf_spectacular.utils import OpenApiParameter, extend_schema
from pydantic import ValidationError as ModelValidationError

from rating_app.application_schemas.ukma_data import UkmaDataPageParams
from rating_app.ioc_container.common import pydantic_to_openapi_request_mapper
from rating_app.serializers.ukma_data import (
    UkmaDataDepartmentPageSerializer,
    UkmaDataFacultyPageSerializer,
    UkmaDataOfferingPageSerializer,
    UkmaDataProgrammePageSerializer,
    UkmaDataReviewCasePageSerializer,
    UkmaDataStatusSerializer,
    UkmaDataTermPageSerializer,
)
from rating_app.services.ukma_data_service import UkmaDataService
from rating_app.views.responses import (
    R_UKMA_DATA_DEPARTMENTS,
    R_UKMA_DATA_FACULTIES,
    R_UKMA_DATA_OFFERINGS,
    R_UKMA_DATA_PROGRAMMES,
    R_UKMA_DATA_REVIEW_CASES,
    R_UKMA_DATA_STATUS,
    R_UKMA_DATA_TERMS,
)

logger = structlog.get_logger(__name__)
to_openapi = pydantic_to_openapi_request_mapper().map

PAGE_PARAMETERS = to_openapi((UkmaDataPageParams, OpenApiParameter.QUERY))
PAGE_DESCRIPTION = (
    "One page of UKMA Data's list in change-number order, removed rows included. "
    "Pass the response's `cursor` as `after` while `has_more` is true. Superusers only."
)


class IsSuperuser(BasePermission):
    # DRF has no stubs, so pyright reads the base's `return True` as Literal[True]
    def has_permission(self, request, view) -> bool:  # pyright: ignore[reportIncompatibleMethodOverride]
        return bool(request.user and request.user.is_superuser)


@extend_schema(tags=["ukma-data"])
class UkmaDataViewSet(viewsets.ViewSet):
    """Reads UKMA Data through the server's own key, so the key never reaches the SPA."""

    permission_classes = [IsAuthenticated, IsSuperuser]

    ukma_data_service: UkmaDataService | None = None

    @extend_schema(
        summary="UKMA Data key and freshness",
        description="The server key's id, scopes and expiry, and when UKMA Data last read its "
        "source. Superusers only.",
        responses=R_UKMA_DATA_STATUS,
    )
    def get_status(self, request: Request) -> Response:
        assert self.ukma_data_service is not None

        payload = self.ukma_data_service.get_status()
        return Response(UkmaDataStatusSerializer(payload).data, status=status.HTTP_200_OK)

    @extend_schema(
        summary="List UKMA Data terms",
        description=PAGE_DESCRIPTION,
        parameters=PAGE_PARAMETERS,
        responses=R_UKMA_DATA_TERMS,
        operation_id="ukma_data_terms_list",
    )
    def terms(self, request: Request) -> Response:
        assert self.ukma_data_service is not None

        page = self.ukma_data_service.list_terms(self._page_params(request))
        return Response(UkmaDataTermPageSerializer(page).data, status=status.HTTP_200_OK)

    @extend_schema(
        summary="List UKMA Data faculties",
        description=PAGE_DESCRIPTION,
        parameters=PAGE_PARAMETERS,
        responses=R_UKMA_DATA_FACULTIES,
        operation_id="ukma_data_faculties_list",
    )
    def faculties(self, request: Request) -> Response:
        assert self.ukma_data_service is not None

        page = self.ukma_data_service.list_faculties(self._page_params(request))
        return Response(UkmaDataFacultyPageSerializer(page).data, status=status.HTTP_200_OK)

    @extend_schema(
        summary="List UKMA Data departments",
        description=PAGE_DESCRIPTION,
        parameters=PAGE_PARAMETERS,
        responses=R_UKMA_DATA_DEPARTMENTS,
        operation_id="ukma_data_departments_list",
    )
    def departments(self, request: Request) -> Response:
        assert self.ukma_data_service is not None

        page = self.ukma_data_service.list_departments(self._page_params(request))
        return Response(UkmaDataDepartmentPageSerializer(page).data, status=status.HTTP_200_OK)

    @extend_schema(
        summary="List UKMA Data programmes",
        description=PAGE_DESCRIPTION,
        parameters=PAGE_PARAMETERS,
        responses=R_UKMA_DATA_PROGRAMMES,
        operation_id="ukma_data_programmes_list",
    )
    def programmes(self, request: Request) -> Response:
        assert self.ukma_data_service is not None

        page = self.ukma_data_service.list_programmes(self._page_params(request))
        return Response(UkmaDataProgrammePageSerializer(page).data, status=status.HTTP_200_OK)

    @extend_schema(
        summary="List UKMA Data course offerings",
        description=PAGE_DESCRIPTION,
        parameters=PAGE_PARAMETERS,
        responses=R_UKMA_DATA_OFFERINGS,
        operation_id="ukma_data_offerings_list",
    )
    def offerings(self, request: Request) -> Response:
        assert self.ukma_data_service is not None

        page = self.ukma_data_service.list_offerings(self._page_params(request))
        return Response(UkmaDataOfferingPageSerializer(page).data, status=status.HTTP_200_OK)

    @extend_schema(
        summary="List UKMA Data review cases",
        description=PAGE_DESCRIPTION,
        parameters=PAGE_PARAMETERS,
        responses=R_UKMA_DATA_REVIEW_CASES,
        operation_id="ukma_data_review_cases_list",
    )
    def review_cases(self, request: Request) -> Response:
        assert self.ukma_data_service is not None

        page = self.ukma_data_service.list_review_cases(self._page_params(request))
        return Response(UkmaDataReviewCasePageSerializer(page).data, status=status.HTTP_200_OK)

    def _page_params(self, request: Request) -> UkmaDataPageParams:
        try:
            return UkmaDataPageParams.model_validate(request.query_params.dict())
        except ModelValidationError as e:
            logger.error("validation_error", errors=e.errors())
            raise ValidationError(detail=e.errors()) from e
