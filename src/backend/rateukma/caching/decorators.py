from collections.abc import Callable
from functools import wraps
from typing import ParamSpec, TypeVar, get_type_hints

import structlog

from .instances import cache_type_extension_registry, redis_cache_manager

_P = ParamSpec("_P")
_RT = TypeVar("_RT")

logger = structlog.get_logger(__name__)


def rcached[**P, RT](
    ttl: int | None = None,
    key: str | None = None,
    return_type: type[RT] | None = None,
) -> Callable[[Callable[P, RT]], Callable[P, RT]]:
    def decorator(func: Callable[P, RT]) -> Callable[P, RT]:
        type_hints = get_type_hints(func)
        annotated_return = type_hints.get("return")
        cached_value_type = return_type or annotated_return

        @wraps(func)
        def wrapper(*args: P.args, **kwargs: P.kwargs) -> RT:
            cache_manager = redis_cache_manager()
            extension_registry = cache_type_extension_registry()

            if cached_value_type is None:
                raise ValueError(
                    "No return type provided. \
                    Please provide a return type annotation or  \
                    use the @rcached decorator with a return type parameter."
                )

            # try to get cached data
            ext = extension_registry.get_extension(cached_value_type)
            cache_key = key or ext.get_cache_key(func, args, kwargs)
            cached_data = cache_manager.get(cache_key)

            # deserialize it and return
            if cached_data is not None:
                return ext.deserialize(cached_data, cached_value_type)

            # execute the function and cache the result
            result = func(*args, **kwargs)
            serialized_result = ext.serialize(result)
            cache_manager.set(cache_key, serialized_result, ttl)

            return result

        return wrapper

    return decorator


def invalidate_cache_for(
    method_name: str, pattern: str | None = None
) -> Callable[[Callable[_P, _RT]], Callable[_P, _RT]]:
    """
    Decorator that invalidates cache for a specific method when this method is called.

    Args:
        method_name: Name of the method whose cache should be invalidated
        pattern: Optional pattern to match cache keys (defaults to method name pattern)
    """

    def decorator(func: Callable[_P, _RT]) -> Callable[_P, _RT]:
        @wraps(func)
        def wrapper(*args: _P.args, **kwargs: _P.kwargs) -> _RT:
            result = func(*args, **kwargs)

            cache_manager = redis_cache_manager()
            if pattern:
                cache_manager.invalidate_pattern(pattern)
                return result

            class_name = ""
            if args and hasattr(args[0], "__class__"):
                class_name = args[0].__class__.__name__

            patterns_to_try = []
            if class_name:
                patterns_to_try.insert(
                    0, f"*{class_name}.{method_name}*"
                )  # Any key containing the class name and method name

            total_deleted = 0

            for pat in patterns_to_try:
                total_deleted += cache_manager.invalidate_pattern(pat)

            logger.info(
                "invalidated_cache_keys", total_deleted=total_deleted, seek_patterns=patterns_to_try
            )

            return result

        return wrapper

    return decorator
