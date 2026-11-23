from django.conf import settings

import requests
import structlog
from pydantic import BaseModel, ValidationError

from rating_app.application_schemas import ukma_data_api as ud
from rating_app.application_schemas.ukma_data_params import (
    UKMA_DATA_MAX_PAGE_SIZE,
    UkmaDataKey,
    UkmaDataPageParams,
    UkmaDataReviewCaseParams,
    UkmaDataStatus,
)
from rating_app.exception.ukma_data_exceptions import (
    UkmaDataDecisionNotFoundError,
    UkmaDataDecisionRefusedError,
    UkmaDataForbiddenError,
    UkmaDataNotConfiguredError,
    UkmaDataUnavailableError,
)

logger = structlog.get_logger(__name__)

# Connecting to UKMA Data on our own network is quick; a slow connect means it is down.
UKMA_DATA_CONNECT_TIMEOUT_SECONDS = 3.05


class UkmaDataService:
    """Reads UKMA Data's read API with the server's own key.

    Settings are read per call rather than held by the IoC singleton, so
    `override_settings` reaches them.
    """

    def list_terms(self, params: UkmaDataPageParams) -> ud.TermPage:
        return self._get_page("/v1/terms", params, ud.TermPage)

    def list_faculties(self, params: UkmaDataPageParams) -> ud.FacultyPage:
        return self._get_page("/v1/faculties", params, ud.FacultyPage)

    def list_departments(self, params: UkmaDataPageParams) -> ud.DepartmentPage:
        return self._get_page("/v1/departments", params, ud.DepartmentPage)

    def list_programmes(self, params: UkmaDataPageParams) -> ud.ProgrammePage:
        return self._get_page("/v1/programmes", params, ud.ProgrammePage)

    def list_courses(self, params: UkmaDataPageParams) -> ud.CoursePage:
        return self._get_page("/v1/courses", params, ud.CoursePage)

    def list_offerings(self, params: UkmaDataPageParams) -> ud.OfferingPage:
        return self._get_page("/v1/offerings", params, ud.OfferingPage)

    def list_offering_instructors(
        self, params: UkmaDataPageParams, *, year: int
    ) -> ud.OfferingTeachersPage:
        """One academic year's offerings with their linked teachers; the route
        needs `instructors:read`."""
        return self._get_page(
            "/v1/offerings/instructors",
            params,
            ud.OfferingTeachersPage,
            extra={"year": year},
        )

    def get_key(self) -> UkmaDataKey:
        return self._get("/v1/key", {}, UkmaDataKey)

    def list_review_cases(self, params: UkmaDataReviewCaseParams) -> ud.ReviewCasePage:
        """Cases of one status and kind, or all, with how many match across pages."""
        filters = {"status": params.status, "kind": params.kind}
        return self._get_page(
            "/v1/review-cases",
            params,
            ud.ReviewCasePage,
            extra={name: value for name, value in filters.items() if value is not None},
        )

    def get_status(self) -> UkmaDataStatus:
        key = self.get_key()
        # Every list carries the same dataUpdatedAt (the latest successful run),
        # so the smallest page of the cheapest list is enough to read it.
        terms = self.list_terms(UkmaDataPageParams(limit=1))
        try:
            return UkmaDataStatus.model_validate(
                {
                    "key_id": key.id,
                    "scopes": key.scopes,
                    "key_expires_at": key.expires_at,
                    "data_updated_at": terms.data_updated_at,
                }
            )
        except ValidationError as exc:
            errors = exc.errors(include_input=False, include_url=False)
            logger.warning("ukma_data_unexpected_response", path="/v1/key", errors=errors)
            raise UkmaDataUnavailableError("UKMA Data sent an unexpected response.") from exc

    def decide_case(self, case_id: str) -> None:
        """Close a `student_match` case as the same person."""
        self._decide(
            f"/v1/review-cases/{case_id}/decide",
            {"decision": "same_person"},
        )

    def merge_course(self, course_id: str, into: str) -> None:
        self._decide(f"/v1/courses/{course_id}/merge", {"into": into})

    def unmerge_course(self, course_id: str) -> None:
        self._decide(f"/v1/courses/{course_id}/unmerge", None)

    def _decide(self, path: str, body: dict[str, str] | None) -> None:
        base_url = settings.UKMA_DATA_URL
        api_key = settings.UKMA_DATA_API_KEY
        if not base_url or not api_key:
            raise UkmaDataNotConfiguredError()

        try:
            response = requests.post(
                f"{base_url.rstrip('/')}{path}",
                json=body,
                headers={"Authorization": f"Bearer {api_key}"},
                timeout=(UKMA_DATA_CONNECT_TIMEOUT_SECONDS, settings.UKMA_DATA_TIMEOUT_SECONDS),
            )
        except requests.Timeout as exc:
            logger.warning("ukma_data_decision_timeout", path=path)
            raise UkmaDataUnavailableError("UKMA Data did not answer in time.") from exc
        except requests.RequestException as exc:
            logger.warning("ukma_data_decision_unreachable", path=path, err=str(exc))
            raise UkmaDataUnavailableError("UKMA Data is unreachable.") from exc

        if response.status_code == 204:
            return
        if response.status_code == 404:
            logger.warning("ukma_data_decision_not_found", path=path)
            raise UkmaDataDecisionNotFoundError()
        if response.status_code == 409:
            reason = _refusal_reason(response)
            logger.warning("ukma_data_decision_refused", path=path, reason=reason)
            raise UkmaDataDecisionRefusedError(reason)
        if response.status_code in (401, 403):
            logger.warning("ukma_data_forbidden", path=path)
            raise UkmaDataForbiddenError()

        logger.warning("ukma_data_decision_error_status", path=path, status=response.status_code)
        raise UkmaDataUnavailableError(f"UKMA Data answered {response.status_code}.")

    def _get_page[P: BaseModel](
        self,
        path: str,
        params: UkmaDataPageParams,
        page: type[P],
        extra: dict[str, int | str] | None = None,
    ) -> P:
        query: dict[str, int | str] = dict(extra or {})
        if params.after is not None:
            query["after"] = params.after
        if params.limit is not None:
            query["limit"] = min(params.limit, UKMA_DATA_MAX_PAGE_SIZE)
        return self._get(path, query, page)

    def _get[M: BaseModel](self, path: str, query: dict[str, int | str], model: type[M]) -> M:
        base_url = settings.UKMA_DATA_URL
        api_key = settings.UKMA_DATA_API_KEY
        if not base_url or not api_key:
            raise UkmaDataNotConfiguredError()

        try:
            response = requests.get(
                f"{base_url.rstrip('/')}{path}",
                params=query,
                headers={"Authorization": f"Bearer {api_key}"},
                timeout=(UKMA_DATA_CONNECT_TIMEOUT_SECONDS, settings.UKMA_DATA_TIMEOUT_SECONDS),
            )
        except requests.Timeout as exc:
            logger.warning("ukma_data_timeout", path=path)
            raise UkmaDataUnavailableError("UKMA Data did not answer in time.") from exc
        except requests.RequestException as exc:
            logger.warning("ukma_data_unreachable", path=path, err=str(exc))
            raise UkmaDataUnavailableError("UKMA Data is unreachable.") from exc

        if response.status_code == 403:
            logger.warning("ukma_data_forbidden", path=path)
            raise UkmaDataForbiddenError()

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


def _refusal_reason(response: requests.Response) -> str:
    try:
        body = response.json()
    except ValueError:
        return "refused"
    if isinstance(body, dict) and isinstance(body.get("reason"), str):
        return body["reason"]
    return "refused"
