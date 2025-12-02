from collections.abc import Callable
from functools import wraps
from typing import ParamSpec, TypeVar

from ..ioc.instances import redis_cache_manager
from .cache_manager import ICacheManager

_P = ParamSpec("_P")
_RT = TypeVar("_RT", covariant=True)


class NotSetType:
    pass


NOT_SET = NotSetType()


def rcached(ttl: int | None = None, key: Callable[[tuple, dict], str] | None = None):
    def decorator(func: Callable[_P, _RT]) -> Callable[_P, _RT]:
        @wraps(func)
        def wrapper(*args: _P.args, **kwargs: _P.kwargs) -> _RT:
            cache_manager: ICacheManager = redis_cache_manager()
            cache_key = key(args, kwargs) if key else f"{func.__name__}:{args}:{kwargs}"
            cached_value = cache_manager.get(cache_key)

            if cached_value is not None:
                return cached_value

            result = func(*args, **kwargs)

            cache_manager.set(cache_key, result, ttl)
            return result

        return wrapper

    return decorator
