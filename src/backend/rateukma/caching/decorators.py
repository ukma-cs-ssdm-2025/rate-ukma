from collections.abc import Callable
from functools import wraps
from typing import ParamSpec, TypeVar, get_type_hints

from django.conf import settings

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
    """
    Decorator that caches the result of a function in Redis.

    Args:
        ttl: Time to live for the cached value in seconds (defaults to 300 seconds)
        key: Optional key to use (defaults to the function name + args + kwargs)
        return_type: Optional return type to use for the cached value
           (defaults to the function return type annotation)

    Usage:
        @rcached(ttl=300)
        def my_function() -> int:
            return 42

        @rcached(ttl=300, key="my_function", return_type=int)
        def my_function():
            return 42

        @rcached(ttl=300)
        def my_view(self) -> Response:
            return Response(status=200, data={"message": "Test"})

        @rcached(ttl=300)
        def my_service_method(self) -> MyPydanticModel:
            return MyPydanticModel(name="Test", age=20)
    """

    def decorator(func: Callable[P, RT]) -> Callable[P, RT]:
        type_hints = get_type_hints(func)
        annotated_return = type_hints.get("return")
        cached_value_type = return_type or annotated_return

        @wraps(func)
        def wrapper(*args: P.args, **kwargs: P.kwargs) -> RT:
            if not settings.ENABLE_CACHE:
                return func(*args, **kwargs)

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
            serialized_result = ext.serialize(result, cached_value_type)
            cache_manager.set(cache_key, serialized_result, ttl)

            return result

        return wrapper

    return decorator


def invalidate_cache_for(
    method_name: str | None = None, patterns: str | list[str] | None = None
) -> Callable[[Callable[_P, _RT]], Callable[_P, _RT]]:
    """
    Decorator that invalidates cache for given patterns when the decorated method is called.

    Args:
        method_name: Optional name of the method whose cache should be invalidated.
          Looks for the method in the current class it is called in if not provided.
        patterns: Optional pattern(s) to match cache keys. Can be:
            - None: Auto-generate pattern from class.method name
            - str: Single pattern to match
            - list[str]: Multiple patterns to match (all will be invalidated)

    Either method_name or patterns must be provided.

    Usage:
        @invalidate_cache_for("my_method")
        def my_method():
            return 42

        @invalidate_cache_for("my_method", patterns="my_pattern")
        def my_method():
            return 42

        @invalidate_cache_for("my_method", patterns=["MyClass.my_method*00*", "MyClass.my_method*"])
        def my_method():
            return 42
    """

    def decorator(func: Callable[_P, _RT]) -> Callable[_P, _RT]:
        @wraps(func)
        def wrapper(*args: _P.args, **kwargs: _P.kwargs) -> _RT:
            if not method_name and not patterns:
                raise ValueError(
                    "Either method_name or patterns must be provided. \
                    Please provide a method name or patterns parameter."
                )

            result = func(*args, **kwargs)

            cache_manager = redis_cache_manager()

            patterns_to_try = []
            if patterns:
                if isinstance(patterns, str):
                    patterns_to_try = [patterns]
                elif isinstance(patterns, list):
                    patterns_to_try = patterns
            elif method_name:
                # Auto-generate pattern from class.method name
                class_name = ""
                if args and hasattr(args[0], "__class__"):
                    class_name = args[0].__class__.__name__

                if class_name:
                    patterns_to_try = [f"*{class_name}.{method_name}*"]

            total_deleted = 0
            for pat in patterns_to_try:
                total_deleted += cache_manager.invalidate_pattern(pat)

            logger.info(
                "invalidated_cache_keys", total_deleted=total_deleted, patterns=patterns_to_try
            )

            return result

        return wrapper

    return decorator
