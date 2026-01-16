from django.conf import settings
from rest_framework.response import Response

from redis import Redis

from ..caching.cache_manager import ICacheManager, InMemoryCacheManager, RedisCacheManager
from ..ioc.decorators import once
from .types_extensions import (
    CacheKeyContextProvider,
    CacheTypeExtensionRegistry,
    DRFResponseCacheTypeExtension,
    TypeAdapterCacheExtension,
)


@once
def redis_cache_manager() -> ICacheManager:
    if not settings.ENABLE_CACHE:
        return InMemoryCacheManager()

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
        ignore_exceptions=True,  # gracefully handle exceptions
    )


@once
def cache_key_context_provider() -> CacheKeyContextProvider:
    return CacheKeyContextProvider()


@once
def cache_type_extension_registry() -> CacheTypeExtensionRegistry:
    registry = CacheTypeExtensionRegistry(
        custom_extensions={
            Response: DRFResponseCacheTypeExtension(cache_key_context_provider()),
        },
        generic_extension=TypeAdapterCacheExtension(cache_key_context_provider()),
    )

    return registry
