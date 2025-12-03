from collections.abc import Callable
from functools import wraps
from typing import ParamSpec, TypeVar, get_type_hints

from .instances import cache_type_extension_registry, redis_cache_manager

_P = ParamSpec("_P")
_RT = TypeVar("_RT")


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
            cache_key = key or ext.get_cache_key(func, args, kwargs, cached_value_type)
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
