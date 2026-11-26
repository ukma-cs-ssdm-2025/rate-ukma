"""DRF serializers that describe UKMA Data's generated pydantic models.

drf-spectacular can read pydantic models directly, but it names the components
after the generated classes (`OfferingPage`, `Kind1`, ...), while the webapp
imports the `UkmaData*` names the hand-written serializers produced. These
serializers take their fields from the generated models and only map pydantic
types to DRF fields, so the API spec keeps its component names and the field
lists stay in one place: the parser's OpenAPI spec.
"""

import datetime
from enum import Enum
from types import UnionType
from typing import Any, Union, get_args, get_origin

from django.core.validators import RegexValidator
from rest_framework import serializers

from pydantic import BaseModel

from rating_app.application_schemas import ukma_data_api as ud
from rating_app.application_schemas.ukma_data_params import UKMA_DATA_ID_PATTERN, UkmaDataStatus
from rating_app.models.sync import UkmaDataDecisionAction, UkmaDataDecisionOutcome

_SERIALIZERS: dict[type[BaseModel], type[serializers.Serializer]] = {}


def _optional_parts(annotation: Any) -> tuple[tuple[Any, ...], bool]:
    origin = get_origin(annotation)
    if origin is not Union and origin is not UnionType:
        return (annotation,), False
    args = get_args(annotation)
    present = tuple(arg for arg in args if arg is not type(None))
    return present, len(present) != len(args)


def _enum(annotation: Any) -> type[Enum] | None:
    if isinstance(annotation, type) and issubclass(annotation, Enum):
        return annotation
    return None


def _model(annotation: Any) -> type[BaseModel] | None:
    if isinstance(annotation, type) and issubclass(annotation, BaseModel):
        return annotation
    return None


def _make_field(
    annotation: Any, description: str | None, *, read_only: bool = True
) -> serializers.Field:
    present, optional = _optional_parts(annotation)
    if len(present) == 1:
        return _scalar_field(present[0], description, optional, read_only)
    if all(part is float or _enum(part) for part in present):
        return serializers.FloatField(
            help_text=description, allow_null=optional, read_only=read_only
        )
    raise TypeError(f"UKMA Data serializer cannot describe {annotation!r}")


def _scalar_field(
    annotation: Any, description: str | None, optional: bool, read_only: bool
) -> serializers.Field:
    options = {"help_text": description, "allow_null": optional, "read_only": read_only}
    if annotation is Any:
        return serializers.JSONField(**options)
    if annotation is str:
        return serializers.CharField(**options)
    if annotation is int:
        return serializers.IntegerField(**options)
    if annotation is float:
        return serializers.FloatField(**options)
    if annotation is bool:
        return serializers.BooleanField(**options)
    if annotation is datetime.datetime:
        return serializers.DateTimeField(**options)
    if enum := _enum(annotation):
        return serializers.ChoiceField(choices=[member.value for member in enum], **options)
    if get_origin(annotation) is list:
        (item,) = get_args(annotation)
        if model := _model(item):
            return _serializer_for(model)(many=True, allow_null=optional, read_only=read_only)
        return serializers.ListField(
            child=_make_field(item, None, read_only=False),
            allow_null=optional,
            read_only=read_only,
        )
    if model := _model(annotation):
        return _serializer_for(model)(allow_null=optional, read_only=read_only)
    raise TypeError(f"UKMA Data serializer cannot describe {annotation!r}")


def _serializer_for(model: type[BaseModel]) -> type[serializers.Serializer]:
    cached = _SERIALIZERS.get(model)
    if cached is not None:
        return cached
    fields = {
        name: _make_field(info.annotation, info.description or None)
        for name, info in model.model_fields.items()
    }
    prefix = "" if model.__name__.startswith("UkmaData") else "UkmaData"
    serializer = type(
        f"{prefix}{model.__name__}Serializer",
        (serializers.Serializer,),
        fields,
    )
    _SERIALIZERS[model] = serializer
    return serializer


UkmaDataStatusSerializer = _serializer_for(UkmaDataStatus)
UkmaDataTermPageSerializer = _serializer_for(ud.TermPage)
UkmaDataFacultyPageSerializer = _serializer_for(ud.FacultyPage)
UkmaDataDepartmentPageSerializer = _serializer_for(ud.DepartmentPage)
UkmaDataProgrammePageSerializer = _serializer_for(ud.ProgrammePage)
UkmaDataOfferingPageSerializer = _serializer_for(ud.OfferingPage)
UkmaDataReviewCasePageSerializer = _serializer_for(ud.ReviewCasePage)
UkmaDataStudentCaseSerializer = _serializer_for(ud.StudentCase)

MAX_SITE_OFFERING_IDS = 1000


class UkmaDataSiteOfferingsRequestSerializer(serializers.Serializer):
    ukma_ids = serializers.ListField(
        child=serializers.CharField(
            max_length=64, validators=[RegexValidator(f"^{UKMA_DATA_ID_PATTERN}$")]
        ),
        max_length=MAX_SITE_OFFERING_IDS,
        help_text="UKMA Data offering ids, such as a `removals_held` case's `offeringIds`",
    )


class UkmaDataSiteOfferingSerializer(serializers.Serializer):
    ukma_data_id = serializers.CharField()
    course_id = serializers.UUIDField()
    title = serializers.CharField()
    department = serializers.CharField(allow_null=True)
    year = serializers.IntegerField()
    term = serializers.CharField()
    ratings = serializers.IntegerField()


class UkmaDataSiteOfferingsResponseSerializer(serializers.Serializer):
    items = UkmaDataSiteOfferingSerializer(many=True)
    missing = serializers.IntegerField(
        help_text="Ids with no offering on the site: never linked, or already removed"
    )


class UkmaDataCourseMergeRequestSerializer(serializers.Serializer):
    into = serializers.CharField(
        max_length=64,
        validators=[RegexValidator(f"^{UKMA_DATA_ID_PATTERN}$")],
        help_text="UKMA Data course id the course merges into; both must share a level",
    )


class UkmaDataDecisionResponseSerializer(serializers.Serializer):
    decision_id = serializers.IntegerField()
    action = serializers.ChoiceField(choices=UkmaDataDecisionAction.choices)
    outcome = serializers.ChoiceField(choices=UkmaDataDecisionOutcome.choices)
    detail = serializers.CharField()


class UkmaDataDecideForbiddenSerializer(serializers.Serializer):
    code = serializers.CharField(help_text="Always `ukma_data_forbidden`")
    detail = serializers.CharField()
