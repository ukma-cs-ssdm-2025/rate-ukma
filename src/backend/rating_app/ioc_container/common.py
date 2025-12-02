from django.conf import settings

from drf_spectacular.utils import OpenApiParameter
from pydantic import BaseModel
from redis import Redis

from rateukma.caching.cache_manager import ICacheManager, RedisCacheManager
from rateukma.ioc.decorators import once
from rateukma.protocols.generic import IMapper
from rating_app.api_spec import Location, PydanticToOpenApiRequestMapper


def pydantic_to_openapi_request_mapper() -> IMapper[
    tuple[type[BaseModel], Location], list[OpenApiParameter]
]:
    return PydanticToOpenApiRequestMapper()


@once
def redis_cache_manager() -> ICacheManager:
    redis_client: Redis = Redis(
        host=settings.REDIS_HOST,
        port=settings.REDIS_PORT,
        db=settings.REDIS_DB,
        decode_responses=False,
        socket_timeout=5,
        socket_connect_timeout=5,
        retry_on_timeout=True,
    )

    return RedisCacheManager(
        redis_client=redis_client,
        key_prefix="rateukma",
        default_ttl=300,  # 5 minutes
        ignore_exceptions=False,
    )
