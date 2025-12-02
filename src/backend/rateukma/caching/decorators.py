from collections.abc import Callable
from dataclasses import asdict, is_dataclass
from functools import wraps
from typing import Any, ParamSpec, TypeVar, cast
from urllib.parse import urlencode
from uuid import UUID

from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from pydantic import BaseModel

from rateukma.caching.cache_manager import ICacheManager

from .instances import redis_cache_manager

_P = ParamSpec("_P")
_RT = TypeVar("_RT")

MIN_REQUEST_ARGS_COUNT = 2
REQUEST_ARG_INDEX = 1


def rcached(
    ttl: int | None = None, key: Callable[[tuple, dict], str] | None = None
) -> Callable[[Callable[_P, _RT]], Callable[_P, _RT]]:
    """
    Redis cache decorator.

    Supports:
        - DRF Response
        - BaseModel
        - dataclass

    Args:
        ttl: Time-to-live for cached values in seconds
        key: Custom key generation function
    """

    def decorator(func: Callable[_P, _RT]) -> Callable[_P, _RT]:
        @wraps(func)
        def wrapper(*args: _P.args, **kwargs: _P.kwargs) -> _RT:
            cache_manager = redis_cache_manager()
            cache_key = _generate_cache_key(func, args, kwargs, key)

            cached_result = _try_get_from_cache(cache_manager, cache_key, args)
            if cached_result is not None:
                return cached_result

            result = func(*args, **kwargs)
            _store_in_cache(cache_manager, cache_key, result, ttl)

            return result

        return wrapper

    return decorator


def _generate_cache_key(
    func: Callable, args: tuple, kwargs: dict, custom_key: Callable[[tuple, dict], str] | None
) -> str:
    """Generate cache key using custom function or default logic."""
    if custom_key:
        return custom_key(args, kwargs)
    return _build_default_cache_key(func, args, kwargs)


def _try_get_from_cache(cache_manager: ICacheManager, cache_key: str, args: tuple) -> Any | None:
    cached_value = cache_manager.get(cache_key)

    if cached_value is None:
        return None

    if _is_drf_request_handler(args):
        return cast(Any, Response(cached_value, status=status.HTTP_200_OK))

    return cast(Any, cached_value)


def _is_drf_request_handler(args: tuple) -> bool:
    return len(args) >= MIN_REQUEST_ARGS_COUNT and isinstance(args[REQUEST_ARG_INDEX], Request)


def _store_in_cache(
    cache_manager: ICacheManager, cache_key: str, result: Any, ttl: int | None
) -> None:
    serializable_data = _serialize_result(result)
    json_safe_data = _convert_to_json_serializable(serializable_data)
    cache_manager.set(cache_key, json_safe_data, ttl)


def _serialize_result(result: Any) -> dict | Any:
    if isinstance(result, Response):
        return result.data

    if isinstance(result, BaseModel):
        return result.model_dump()

    if is_dataclass(result) and not isinstance(result, type):
        return asdict(result)

    raise ValueError(
        f"Unsupported result type: {type(result).__name__}. "
        "Supported types: Response, BaseModel, dataclass"
    )


def _build_default_cache_key(func: Callable, args: tuple, kwargs: dict) -> str:
    key_parts = [func.__qualname__]

    if _is_drf_request_handler(args):
        key_parts.extend(_extract_request_key_parts(args[REQUEST_ARG_INDEX], kwargs))
    else:
        key_parts.extend(_extract_function_key_parts(args, kwargs))

    return ":".join(key_parts)


def _extract_request_key_parts(request: Request, path_kwargs: dict) -> list[str]:
    parts = [request.method, request.path]

    if request.query_params:
        query_string = urlencode(sorted(request.query_params.items()))
        parts.append(query_string)

    if path_kwargs:
        path_string = urlencode(sorted(path_kwargs.items()))
        parts.append(path_string)

    return parts


def _extract_function_key_parts(args: tuple, kwargs: dict) -> list[str]:
    parts = []

    if args:
        arg_representations = [_get_safe_representation(arg) for arg in args]
        parts.append("args:" + "|".join(arg_representations))

    if kwargs:
        sorted_kwargs = sorted(kwargs.items())
        kwarg_representations = [
            f"{key}:{_get_safe_representation(value)}" for key, value in sorted_kwargs
        ]
        parts.append("kwargs:" + "|".join(kwarg_representations))

    return parts


def _get_safe_representation(obj: Any) -> str:
    if hasattr(obj, "__dict__") and not isinstance(obj, type):
        return f"{obj.__class__.__name__}()"
    return repr(obj)


def _convert_to_json_serializable(obj: Any) -> Any:
    if isinstance(obj, UUID):
        return str(obj)

    if isinstance(obj, dict):
        return {key: _convert_to_json_serializable(value) for key, value in obj.items()}

    if isinstance(obj, (list, tuple)):
        return [_convert_to_json_serializable(item) for item in obj]

    if hasattr(obj, "__dict__"):
        try:
            return {
                key: _convert_to_json_serializable(value) for key, value in obj.__dict__.items()
            }
        except (AttributeError, TypeError):
            return str(obj)

    return obj
