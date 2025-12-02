import json
from typing import Any, Protocol

import structlog
from redis.client import Redis
from redis.exceptions import RedisError

logger = structlog.get_logger(__name__)


class ICacheManager(Protocol):
    def get(self, key: str) -> Any | None: ...

    def set(self, key: str, value: Any, ttl: int | None = None) -> bool: ...

    def invalidate(self, key: str) -> bool: ...

    def invalidate_pattern(self, pattern: str) -> int: ...

    def get_versioned(self, key: str) -> Any | None: ...

    def set_versioned(self, key: str, value: Any, ttl: int | None = None) -> bool: ...

    def get_versioned_key(self, key: str) -> str: ...

    def increment_version(self, key: str) -> None: ...

    def get_stats(self) -> dict: ...


# TODO: fix stubs
class RedisCacheManager(ICacheManager):
    def __init__(
        self,
        redis_client: Redis,
        key_prefix: str = "rateukma",
        default_ttl: int = 3600,
        ignore_exceptions: bool = True,
    ):
        self.redis_client = redis_client
        self.key_prefix = key_prefix
        self.default_ttl = default_ttl
        self.ignore_exceptions = ignore_exceptions

    def get(self, key: str) -> Any | None:
        try:
            cache_key = self._make_key(key)
            value = self.redis_client.get(cache_key)
            return self._deserialize(value)
        except RedisError as e:
            self._handle_error("get", e)
            return None

    def set(self, key: str, value: Any, ttl: int | None = None) -> bool:
        cache_key = self._make_key(key)

        serialized = self._serialize(value)
        ttl = ttl if ttl is not None else self.default_ttl

        try:
            if ttl:
                ok = self.redis_client.setex(cache_key, ttl, serialized)
            else:
                ok = self.redis_client.set(cache_key, serialized)
            return bool(ok)
        except RedisError as e:
            self._handle_error("set", e)
            return False

    def invalidate(self, key: str) -> bool:
        cache_key = self._make_key(key)
        try:
            deleted = self.redis_client.delete(cache_key)
            return bool(deleted)
        except RedisError as e:
            self._handle_error("delete", e)
            return False

    def increment_version(self, key: str) -> int:
        try:
            version_key = self._version_key(key)
            value = self.redis_client.incr(version_key)
            return int(value)
        except RedisError as e:
            self._handle_error("increment_version", e)
            return 1

    def get_versioned_key(self, key: str) -> str:
        version = self.get_versioned(key)
        return f"{key}:v{version}"

    def get_versioned(self, key: str) -> Any | None:
        versioned_key = self.get_versioned_key(key)
        return self.get(versioned_key)

    def set_versioned(self, key: str, value: Any, ttl: int | None = None) -> bool:
        versioned_key = self.get_versioned_key(key)
        return self.set(versioned_key, value, ttl)

    def invalidate_pattern(self, pattern: str) -> int:
        try:
            full_pattern = self._make_key(pattern)
            cursor = 0
            deleted = 0

            while True:
                cursor, keys = self.redis_client.scan(cursor, match=full_pattern, count=100)

                if keys:
                    deleted += int(self.redis_client.delete(*keys))  # cast

                if cursor == 0:
                    break

            return deleted
        except RedisError as e:
            self._handle_error("invalidate_pattern", e)
            return 0

    def get_stats(self) -> dict:
        try:
            info = self.redis_client.info()
            return {
                "hits": info.get("keyspace_hits", 0),
                "misses": info.get("keyspace_misses", 0),
                "hit_rate": self._calculate_hit_rate(info),
                "used_memory": info.get("used_memory_human"),
                "connected_clients": info.get("connected_clients"),
                "total_keys": self.redis_client.dbsize(),
            }
        except RedisError as e:
            self._handle_error("get_stats", e)
            return {}

    def _make_key(self, key: str) -> str:
        return f"{self.key_prefix}:{key}"

    def _version_key(self, key: str) -> str:
        return f"{self.key_prefix}:version:{key}"

    def _serialize(self, value: Any) -> bytes:
        return json.dumps(value).encode("utf-8")

    def _deserialize(self, value: bytes | str | None) -> Any | None:
        if value is None:
            return None
        if isinstance(value, bytes):
            return json.loads(value.decode("utf-8"))
        return json.loads(value)

    def _handle_error(self, operation: str, error: Exception) -> None:
        logger.error(f"Cache {operation} failed: {str(error)}")
        if not self.ignore_exceptions:
            raise

    def _calculate_hit_rate(self, info: dict) -> float:
        hits = info.get("keyspace_hits", 0)
        misses = info.get("keyspace_misses", 0)
        total = hits + misses

        if total == 0:
            return 0.0

        return round((hits / total) * 100, 2)
