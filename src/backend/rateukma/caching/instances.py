from django.conf import settings

from redis import Redis

from ..caching.cache_manager import ICacheManager, RedisCacheManager
from ..ioc.decorators import once


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
