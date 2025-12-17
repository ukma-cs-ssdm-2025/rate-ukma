from drf_spectacular.utils import OpenApiParameter
from pydantic import BaseModel

from rateukma.ioc.decorators import once
from rateukma.protocols.generic import IMapper
from rating_app.api_spec import Location, PydanticToOpenApiRequestMapper
from rating_app.services.django_mappers.course_model import CourseModelMapper


def pydantic_to_openapi_request_mapper() -> IMapper[
    tuple[type[BaseModel], Location], list[OpenApiParameter]
]:
    return PydanticToOpenApiRequestMapper()


@once
def course_model_mapper() -> CourseModelMapper:
    return CourseModelMapper()
