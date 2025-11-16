from typing import Any, Literal

import structlog
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter
from pydantic import BaseModel

from rateukma.protocols import IMapper, implements

logger = structlog.get_logger(__name__)


FieldType = str | None
Location = Literal["query", "path"]


class PydanticToOpenApiRequestMapper(
    IMapper[tuple[type[BaseModel], Location], list[OpenApiParameter]]
):
    @implements
    def map(self, obj: tuple[type[BaseModel], Location]) -> list[OpenApiParameter]:
        params = []

        location = obj[1]
        model_type = obj[0]

        schema = model_type.model_json_schema()
        properties = schema.get("properties", {})

        for field_name, field_info in properties.items():
            param_name: str = field_info.get("serialization_alias") or field_name
            field_schema: dict[str, Any] = properties.get(field_name, {})

            openapi_type: OpenApiTypes | None = None
            enum: list[str] | None = None

            field_type = self._get_field_type(field_schema)

            openapi_type = self._get_openapi_type(field_type)
            if openapi_type is None:
                logger.warning(f"Unknown field type: {field_type} for field {field_name}")
                continue

            enum = self._get_enum(field_schema)
            description = field_info.get("description", "")
            required = field_info.get("required") or False

            param = self._build_param(
                param_name, openapi_type, description, required, enum, location
            )

            params.append(param)

        return params

    def _get_field_type(self, field_schema: dict[str, Any]) -> FieldType:
        field_format = field_schema.get("format")
        if self._is_uuid_format(field_format):
            return "uuid"

        field_type = field_schema.get("type")
        if field_type is not None:
            return field_type

        if "anyOf" not in field_schema:
            return None

        for union_type in field_schema["anyOf"]:
            if union_type.get("type") == "null":
                continue

            union_format = union_type.get("format")
            if self._is_uuid_format(union_format):
                return "uuid"

            union_field_type = union_type.get("type")
            if union_field_type is not None:
                return union_field_type

        return None

    def _is_uuid_format(self, field_format: str | None) -> bool:
        return field_format == "uuid"

    def _get_openapi_type(self, field_type: str | None) -> OpenApiTypes | None:
        match field_type:
            case "uuid":
                return OpenApiTypes.UUID
            case "string":
                return OpenApiTypes.STR
            case "integer":
                return OpenApiTypes.INT
            case "number":
                return OpenApiTypes.FLOAT
            case "boolean":
                return OpenApiTypes.BOOL
            case _:
                return None

    def _get_enum(self, field_schema: dict[str, Any]) -> list[str] | None:
        if "enum" not in field_schema:
            return None

        return field_schema["enum"]

    def _build_param(
        self,
        param_name: str,
        openapi_type: OpenApiTypes,
        description: str,
        required: bool,
        enum: list[str] | None,
        location: Location = OpenApiParameter.QUERY,
    ) -> OpenApiParameter:
        return OpenApiParameter(
            name=param_name,
            type=openapi_type,
            location=location,
            description=description,
            required=required,
            enum=enum,
        )
