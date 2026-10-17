from django.conf import settings

import requests
import structlog
from pydantic import BaseModel, ValidationError

from rating_app.application_schemas.ukma_data import (
    UKMA_DATA_MAX_PAGE_SIZE,
    UkmaDataDepartment,
    UkmaDataFaculty,
    UkmaDataKey,
    UkmaDataOffering,
    UkmaDataPage,
    UkmaDataPageParams,
    UkmaDataProgramme,
    UkmaDataReviewCase,
    UkmaDataStatus,
    UkmaDataTerm,
)
from rating_app.exception.ukma_data_exceptions import (
    UkmaDataNotConfiguredError,
    UkmaDataUnavailableError,
)

logger = structlog.get_logger(__name__)


class UkmaDataService:
    """Reads UKMA Data's read API with the server's own key.

    Settings are read per call rather than held by the IoC singleton, so
    `override_settings` reaches them.
    """

    def list_terms(self, params: UkmaDataPageParams) -> UkmaDataPage[UkmaDataTerm]:
        return self._get_page("/v1/terms", params, UkmaDataPage[UkmaDataTerm])

    def list_faculties(self, params: UkmaDataPageParams) -> UkmaDataPage[UkmaDataFaculty]:
        return self._get_page("/v1/faculties", params, UkmaDataPage[UkmaDataFaculty])

    def list_departments(self, params: UkmaDataPageParams) -> UkmaDataPage[UkmaDataDepartment]:
        return self._get_page("/v1/departments", params, UkmaDataPage[UkmaDataDepartment])

    def list_programmes(self, params: UkmaDataPageParams) -> UkmaDataPage[UkmaDataProgramme]:
        return self._get_page("/v1/programmes", params, UkmaDataPage[UkmaDataProgramme])

    def list_offerings(self, params: UkmaDataPageParams) -> UkmaDataPage[UkmaDataOffering]:
        return self._get_page("/v1/offerings", params, UkmaDataPage[UkmaDataOffering])

    def list_review_cases(self, params: UkmaDataPageParams) -> UkmaDataPage[UkmaDataReviewCase]:
        return self._get_page("/v1/review-cases", params, UkmaDataPage[UkmaDataReviewCase])

    def get_status(self) -> UkmaDataStatus:
        key = self._get("/v1/key", {}, UkmaDataKey)
        # Every list carries the same dataUpdatedAt (the latest successful run),
        # so the smallest page of the cheapest list is enough to read it.
        terms = self.list_terms(UkmaDataPageParams(limit=1))
        return UkmaDataStatus(
            key_id=key.id,
            scopes=key.scopes,
            key_expires_at=key.expires_at,
            data_updated_at=terms.data_updated_at,
        )

    def _get_page[P: BaseModel](self, path: str, params: UkmaDataPageParams, page: type[P]) -> P:
        query: dict[str, int] = {}
        if params.after is not None:
            query["after"] = params.after
        if params.limit is not None:
            query["limit"] = min(params.limit, UKMA_DATA_MAX_PAGE_SIZE)
        return self._get(path, query, page)

    def _get[M: BaseModel](self, path: str, query: dict[str, int], model: type[M]) -> M:
        base_url = str(settings.UKMA_DATA_URL)
        api_key = str(settings.UKMA_DATA_API_KEY)
        if not base_url or not api_key:
            raise UkmaDataNotConfiguredError()

        try:
            response = requests.get(
                f"{base_url.rstrip('/')}{path}",
                params=query,
                headers={"Authorization": f"Bearer {api_key}"},
                timeout=settings.UKMA_DATA_TIMEOUT_SECONDS,
            )
        except requests.Timeout as exc:
            logger.warning("ukma_data_timeout", path=path)
            raise UkmaDataUnavailableError("UKMA Data did not answer in time.") from exc
        except requests.RequestException as exc:
            logger.warning("ukma_data_unreachable", path=path, err=str(exc))
            raise UkmaDataUnavailableError("UKMA Data is unreachable.") from exc

        if not response.ok:
            logger.warning("ukma_data_error_status", path=path, status=response.status_code)
            raise UkmaDataUnavailableError(f"UKMA Data answered {response.status_code}.")

        try:
            return model.model_validate(response.json())
        except ValidationError as exc:
            # Without inputs: a row's values are UKMA Data's, not ours to log.
            errors = exc.errors(include_input=False, include_url=False)
            logger.warning("ukma_data_unexpected_response", path=path, errors=errors)
            raise UkmaDataUnavailableError("UKMA Data sent an unexpected response.") from exc
        except ValueError as exc:
            logger.warning("ukma_data_non_json_response", path=path)
            raise UkmaDataUnavailableError("UKMA Data sent an unexpected response.") from exc
