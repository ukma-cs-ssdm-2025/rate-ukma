from collections.abc import Callable
from typing import Any, cast

from django.db.models import Count
from rest_framework import status, viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response

import structlog
from drf_spectacular.utils import OpenApiParameter, extend_schema
from pydantic import BaseModel
from pydantic import ValidationError as ModelValidationError

from rating_app.application_schemas.ukma_data_params import (
    UkmaDataPageParams,
    UkmaDataReviewCaseParams,
)
from rating_app.exception.ukma_data_exceptions import (
    UkmaDataDecideDisabledError,
    UkmaDataDecisionNotFoundError,
    UkmaDataDecisionRefusedError,
    UkmaDataForbiddenError,
    UkmaDataUnavailableError,
)
from rating_app.ioc_container.common import pydantic_to_openapi_request_mapper
from rating_app.models import CourseOffering
from rating_app.models.sync import (
    UkmaDataDecision,
    UkmaDataDecisionAction,
    UkmaDataDecisionOutcome,
)
from rating_app.serializers.ukma_data import (
    UkmaDataCourseMergeRequestSerializer,
    UkmaDataDecisionResponseSerializer,
    UkmaDataSiteOfferingsRequestSerializer,
    UkmaDataSiteOfferingsResponseSerializer,
)
from rating_app.services.ukma_data_service import UkmaDataService
from rating_app.views.responses import (
    R_UKMA_DATA_DECISION,
    R_UKMA_DATA_DEPARTMENTS,
    R_UKMA_DATA_FACULTIES,
    R_UKMA_DATA_MERGE,
    R_UKMA_DATA_OFFERINGS,
    R_UKMA_DATA_PROGRAMMES,
    R_UKMA_DATA_REVIEW_CASES,
    R_UKMA_DATA_SITE_OFFERINGS,
    R_UKMA_DATA_STATUS,
    R_UKMA_DATA_STUDENT_CASE,
    R_UKMA_DATA_TERMS,
)

logger = structlog.get_logger(__name__)
to_openapi = pydantic_to_openapi_request_mapper().map

PAGE_PARAMETERS = to_openapi((UkmaDataPageParams, OpenApiParameter.QUERY))
REVIEW_CASE_PARAMETERS = to_openapi((UkmaDataReviewCaseParams, OpenApiParameter.QUERY))
PAGE_DESCRIPTION = (
    "One page of UKMA Data's list in change-number order, removed rows included. "
    "Pass the response's `cursor` as `after` while `has_more` is true. Superusers only."
)


# Written before the call, so an attempt whose answer never got recorded still shows who sent it.
NO_ANSWER = "no_answer"


class IsSuperuser(BasePermission):
    def has_permission(self, request, view) -> bool:  # pyright: ignore[reportIncompatibleMethodOverride]  # DRF has no stubs, base reads as Literal[True]
        return bool(request.user and request.user.is_superuser)


@extend_schema(tags=["ukma-data"])
class UkmaDataViewSet(viewsets.ViewSet):
    """Reads UKMA Data through the server's own key, so the key never reaches the SPA."""

    permission_classes = [IsAuthenticated, IsSuperuser]

    ukma_data_service: UkmaDataService | None = None

    @extend_schema(
        summary="UKMA Data key and freshness",
        description="The server key's id, scopes and expiry, and when UKMA Data last read its "
        "source. The freshness comes from the terms list, so a key without `catalog:read` "
        "gets 502. Superusers only.",
        responses=R_UKMA_DATA_STATUS,
    )
    def get_status(self, request: Request) -> Response:
        assert self.ukma_data_service is not None

        payload = self.ukma_data_service.get_status()
        return Response(payload.model_dump(mode="json"), status=status.HTTP_200_OK)

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
        return Response(page.model_dump(mode="json"), status=status.HTTP_200_OK)

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
        return Response(page.model_dump(mode="json"), status=status.HTTP_200_OK)

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
        return Response(page.model_dump(mode="json"), status=status.HTTP_200_OK)

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
        return Response(page.model_dump(mode="json"), status=status.HTTP_200_OK)

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
        return Response(page.model_dump(mode="json"), status=status.HTTP_200_OK)

    @extend_schema(
        summary="List UKMA Data review cases",
        description=PAGE_DESCRIPTION
        + " `status` and `kind` narrow the list; `total` counts every matching case.",
        parameters=REVIEW_CASE_PARAMETERS,
        responses=R_UKMA_DATA_REVIEW_CASES,
        operation_id="ukma_data_review_cases_list",
    )
    def review_cases(self, request: Request) -> Response:
        assert self.ukma_data_service is not None

        page = self.ukma_data_service.list_review_cases(
            self._query(request, UkmaDataReviewCaseParams)
        )
        return Response(page.model_dump(mode="json"), status=status.HTTP_200_OK)

    @extend_schema(
        summary="Read a UKMA Data student case",
        description="A `student_match` case with the record that opened it and each "
        "matching student: name, programme, study year and status, so staff can tell "
        "whether they are one person. Another kind of case answers 409. Superusers only.",
        responses=R_UKMA_DATA_STUDENT_CASE,
        operation_id="ukma_data_review_case_retrieve",
    )
    def student_case(self, request: Request, case_id: str) -> Response:
        found = self._service().get_student_case(case_id)
        return Response(found.model_dump(mode="json"), status=status.HTTP_200_OK)

    @extend_schema(
        summary="Find site offerings by UKMA Data ids",
        description="The course offerings on this site linked to the given UKMA Data "
        "offering ids, with their course, semester and rating count, so a "
        "`removals_held` case can name what it would remove. Reads only this site's "
        "database. Superusers only.",
        request=UkmaDataSiteOfferingsRequestSerializer,
        responses=R_UKMA_DATA_SITE_OFFERINGS,
        operation_id="ukma_data_site_offerings",
    )
    def site_offerings(self, request: Request) -> Response:
        body = UkmaDataSiteOfferingsRequestSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        ids = list(dict.fromkeys(cast(dict[str, Any], body.validated_data)["ukma_ids"]))
        rows = (
            CourseOffering.objects.filter(ukma_data_id__in=ids)
            .select_related("course__department", "semester")
            .annotate(rating_count=Count("ratings"))
            .order_by("-rating_count", "course__title", "-semester__year")
        )
        items = [
            {
                "ukma_data_id": offering.ukma_data_id,
                "course_id": offering.course_id,
                "title": offering.course.title,
                "department": offering.course.department.name,
                "year": offering.semester.year,
                "term": offering.semester.term,
                "ratings": offering.rating_count,  # pyright: ignore[reportAttributeAccessIssue]  # set by annotate()
            }
            for offering in rows
        ]
        payload = UkmaDataSiteOfferingsResponseSerializer(
            {"items": items, "missing": len(ids) - len(items)}
        )
        return Response(payload.data, status=status.HTTP_200_OK)

    @extend_schema(
        summary="Decide a UKMA Data review case",
        description="Close an open `student_match` case as the same person. Needs the "
        "server's UKMA Data key with `review:decide`; without it the answer is 403 "
        "`ukma_data_forbidden` before UKMA Data is called. Superusers only.",
        request=None,
        responses=R_UKMA_DATA_DECISION,
        operation_id="ukma_data_review_case_decide",
    )
    def decide_case(self, request: Request, case_id: str) -> Response:
        return self._attempt(
            request,
            UkmaDataDecisionAction.DECIDE_CASE,
            case_id,
            "",
            lambda: self._service().decide_case(case_id),
            "Справу закрито: це та сама людина.",
        )

    @extend_schema(
        summary="Merge a UKMA Data course",
        description="Merge a course into another of the same level; UKMA Data keeps the "
        "decision. Needs the server's UKMA Data key with `review:decide`, otherwise 403 "
        "`ukma_data_forbidden`. Superusers only.",
        request=UkmaDataCourseMergeRequestSerializer,
        responses=R_UKMA_DATA_MERGE,
        operation_id="ukma_data_course_merge",
    )
    def merge_course(self, request: Request, course_id: str) -> Response:
        body = UkmaDataCourseMergeRequestSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        data = cast(dict[str, Any], body.validated_data)
        into = str(data["into"])
        return self._attempt(
            request,
            UkmaDataDecisionAction.MERGE_COURSE,
            course_id,
            into,
            lambda: self._service().merge_course(course_id, into),
            "Курс об'єднано.",
        )

    @extend_schema(
        summary="Undo a UKMA Data course merge",
        description="Unmerge a course that UKMA Data merged. Needs the server's UKMA Data key "
        "with `review:decide`, otherwise 403 `ukma_data_forbidden`. Superusers only.",
        request=None,
        responses=R_UKMA_DATA_DECISION,
        operation_id="ukma_data_course_unmerge",
    )
    def unmerge_course(self, request: Request, course_id: str) -> Response:
        return self._attempt(
            request,
            UkmaDataDecisionAction.UNMERGE_COURSE,
            course_id,
            "",
            lambda: self._service().unmerge_course(course_id),
            "Курс роз'єднано.",
        )

    def _service(self) -> UkmaDataService:
        assert self.ukma_data_service is not None
        return self.ukma_data_service

    def _attempt(
        self,
        request: Request,
        action: str,
        target_id: str,
        related_id: str,
        call: Callable[[], None],
        detail: str,
    ) -> Response:
        service = self._service()
        if "review:decide" not in service.get_key().scopes:
            logger.warning("ukma_data_decide_forbidden", action=action, target_id=target_id)
            raise UkmaDataDecideDisabledError()

        row = UkmaDataDecision.objects.create(
            user=request.user,
            action=action,
            target_id=target_id,
            related_id=related_id,
            outcome=UkmaDataDecisionOutcome.FAILED,
            error=NO_ANSWER,
        )
        try:
            call()
        except UkmaDataDecisionRefusedError as exc:
            self._settle(row, UkmaDataDecisionOutcome.REFUSED, exc.reason)
            logger.info(
                "ukma_data_decision_refused",
                action=action,
                target_id=target_id,
                reason=exc.reason,
            )
            raise
        except UkmaDataDecisionNotFoundError:
            self._settle(row, UkmaDataDecisionOutcome.REFUSED, "not_found")
            logger.info("ukma_data_decision_not_found", action=action, target_id=target_id)
            raise
        except UkmaDataForbiddenError:
            self._settle(row, UkmaDataDecisionOutcome.REFUSED, "forbidden")
            logger.warning("ukma_data_decision_forbidden", action=action, target_id=target_id)
            raise
        except UkmaDataUnavailableError as exc:
            self._settle(row, UkmaDataDecisionOutcome.FAILED, str(exc.detail))
            logger.warning("ukma_data_decision_failed", action=action, target_id=target_id)
            raise

        self._settle(row, UkmaDataDecisionOutcome.DONE, "")
        logger.info(
            "ukma_data_decision_done",
            decision_id=row.pk,
            action=action,
            target_id=target_id,
        )
        payload = UkmaDataDecisionResponseSerializer(
            {
                "decision_id": row.pk,
                "action": action,
                "outcome": row.outcome,
                "detail": detail,
            }
        )
        return Response(payload.data, status=status.HTTP_200_OK)

    def _settle(self, row: UkmaDataDecision, outcome: str, error: str) -> None:
        row.outcome = outcome
        row.error = error
        row.save(update_fields=["outcome", "error"])

    def _page_params(self, request: Request) -> UkmaDataPageParams:
        return self._query(request, UkmaDataPageParams)

    def _query[M: BaseModel](self, request: Request, model: type[M]) -> M:
        try:
            return model.model_validate(request.query_params.dict())
        except ModelValidationError as e:
            errors = e.errors(include_input=False, include_url=False)
            logger.error("validation_error", errors=errors)
            field_errors: dict[str, list[str]] = {}
            for error in errors:
                field = str(error["loc"][0]) if error["loc"] else "non_field_errors"
                field_errors.setdefault(field, []).append(error["msg"])
            raise ValidationError(detail=field_errors) from e
