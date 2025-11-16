from drf_spectacular.utils import OpenApiParameter
from pydantic import BaseModel

from rateukma.protocols.generic import IMapper
from rating_app.views.api_spec import Location, PydanticToOpenApiRequestMapper


def pydantic_to_openapi_request_mapper() -> IMapper[
    tuple[type[BaseModel], Location], list[OpenApiParameter]
]:
    return PydanticToOpenApiRequestMapper()
