import json
from collections.abc import Callable
from dataclasses import asdict, is_dataclass
from typing import Any, Protocol, TypeVar

from rest_framework.request import Request
from rest_framework.response import Response

from pydantic import BaseModel

from .cache_manager import CacheJsonDataEncoder

K = TypeVar("K")
V = TypeVar("V")
_P = TypeVar("_P")
_RT = TypeVar("_RT")


def _make_cache_key_from_context(func: Callable, args: tuple, kwargs: dict) -> str:
    func_name = f"{func.__module__}.{func.__qualname__}"

    try:
        params_str = json.dumps(
            {k: repr(v) for k, v in kwargs.items() if k not in ("self", "cls", "request")},
            sort_keys=True,
            cls=CacheJsonDataEncoder,
        )

        return f"{func_name}:{params_str}"

    except Exception as e:
        raise ValueError(f"Failed to serialize cache data: {e}") from e


class ICacheTypeExtension[V](Protocol):
    """
    Cache type extension that handles serialization/deserialization
    and cache key generation from function context
    """

    def get_cache_key(self, func: Callable, args: tuple, kwargs: dict, value: V) -> str:
        """Generate cache key from function context (name + params) and value"""
        ...

    def serialize(self, value: V) -> dict[str, Any]: ...

    def deserialize(self, data: dict[str, Any], value_type: type[V]) -> V: ...


class DRFResponseCacheTypeExtension(ICacheTypeExtension[Response]):
    def get_cache_key(self, func: Callable, args: tuple, kwargs: dict, value: Response) -> str:
        request = None
        for arg in args:
            if isinstance(arg, Request):
                request = arg
                break

        if request is None:
            return _make_cache_key_from_context(func, args, kwargs)

        query_string = "&".join(f"{k}={v}" for k, v in sorted(request.query_params.items()))
        path_with_query = (
            f"{request.method}:{request.path}?{query_string}"
            if query_string
            else f"{request.method}:{request.path}"
        )
        func_name = f"{func.__module__}.{func.__qualname__}"

        return f"{func_name}:{path_with_query}"

    def serialize(self, value: Response) -> dict[str, Any]:
        if isinstance(value.data, dict):
            return {"_wrapped": False, **value.data}
        return {"_wrapped": True, "data": value.data}

    def deserialize(self, data: dict[str, Any], value_type: type[Response]) -> Response:
        if data.get("_wrapped"):
            return Response(data=data["data"])
        data.pop("_wrapped", None)
        return Response(data=data)


class BaseModelCacheTypeExtension(ICacheTypeExtension[BaseModel]):
    def get_cache_key(self, func: Callable, args: tuple, kwargs: dict, value: BaseModel) -> str:
        func_key = _make_cache_key_from_context(func, args, kwargs)

        model_name = type(value).__name__
        model_id = getattr(value, "id", None) or getattr(value, "pk", None)
        if model_id:
            return f"{func_key}:{model_name}:{model_id}"

        return f"{func_key}:{model_name}"

    def serialize(self, value: BaseModel) -> dict[str, Any]:
        return value.model_dump()

    def deserialize(self, data: dict[str, Any], value_type: type[BaseModel]) -> BaseModel:
        return value_type.model_validate(data)


class DataclassCacheTypeExtension(ICacheTypeExtension[Any]):
    def get_cache_key(self, func: Callable, args: tuple, kwargs: dict, value: Any) -> str:
        if not is_dataclass(value):
            raise TypeError(f"{value} is not a dataclass instance")

        func_key = _make_cache_key_from_context(func, args, kwargs)
        value_type = type(value)
        return f"{func_key}:{value_type.__name__}"

    def serialize(self, value: Any) -> dict[str, Any]:
        if not is_dataclass(value):
            raise TypeError(f"{value} is not a dataclass instance")
        return asdict(value)  # type: ignore

    def deserialize(self, data: dict[str, Any], value_type: type) -> Any:
        if not is_dataclass(value_type):
            raise TypeError(f"{value_type} is not a dataclass")
        return value_type(**data)


# TBD: class QuerySetCacheTypeExtension(ICacheTypeExtension[str, QuerySet]):


class CacheTypeExtensionRegistry:
    def __init__(
        self,
        extensions: dict[type, ICacheTypeExtension],
    ):
        self._extensions = extensions

    def register(self, value_type: type, extension: ICacheTypeExtension) -> None:
        self._extensions[value_type] = extension

    def get_extension(self, extension_type: type) -> ICacheTypeExtension:
        if extension_type in self._extensions:
            return self._extensions[extension_type]

        if issubclass(extension_type, BaseModel):
            return self._extensions[BaseModel]

        if is_dataclass(extension_type):
            return self._extensions[DataclassCacheTypeExtension]  # specific case for dataclasses

        raise TypeError(f"No cache extension registered for type: {extension_type}")
