import json
from collections.abc import Callable
from dataclasses import asdict, is_dataclass
from typing import Any, Protocol, TypeVar

from rest_framework.request import Request
from rest_framework.response import Response

from pydantic import BaseModel

from .cache_manager import CacheJsonDataEncoder, JSON_Serializable

K = TypeVar("K")
V = TypeVar("V")
_P = TypeVar("_P")
_RT = TypeVar("_RT")


def _make_cache_key_from_context(func: Callable, args: tuple, kwargs: dict) -> str:
    func_name = f"{func.__module__}.{func.__qualname__}"

    params_dict = {}

    for i, arg in enumerate(args):
        # skip self/cls and common instance patterns to avoid unstable repr
        if hasattr(arg, "__dict__") and not isinstance(
            arg, (str, int, float, bool, list, dict, tuple)
        ):
            continue
        params_dict[f"arg_{i}"] = repr(arg)

    for k, v in kwargs.items():
        if k not in ("self", "cls", "request"):
            params_dict[k] = repr(v)

    try:
        params_str = json.dumps(params_dict, sort_keys=True, cls=CacheJsonDataEncoder)
    except ValueError as e:
        raise e

    return f"{func_name}:{params_str}"


class ICacheTypeExtension[V](Protocol):
    """
    Cache type extension that handles serialization/deserialization
    and cache key generation from function context
    """

    def get_cache_key(self, func: Callable, args: tuple, kwargs: dict) -> str:
        """Generate cache key from function context (name + params)"""
        ...

    def serialize(self, value: V) -> JSON_Serializable: ...

    def deserialize(self, data: JSON_Serializable, value_type: type[V]) -> V: ...


class DRFResponseCacheTypeExtension(ICacheTypeExtension[Response]):
    def get_cache_key(self, func: Callable, args: tuple, kwargs: dict) -> str:
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

    def serialize(self, value: Response) -> JSON_Serializable:
        if isinstance(value.data, dict):
            return {"_wrapped": False, **value.data}
        return {"_wrapped": True, "data": value.data}

    def deserialize(self, data: JSON_Serializable, value_type: type[Response]) -> Response:
        if not isinstance(data, dict):
            raise TypeError(f"Expected dict for Response deserialization, got {type(data)}")

        if data.get("_wrapped"):
            return Response(data=data["data"])

        data.pop("_wrapped", None)
        return Response(data=data)


class BaseModelCacheTypeExtension(ICacheTypeExtension[BaseModel]):
    def get_cache_key(self, func: Callable, args: tuple, kwargs: dict) -> str:
        return _make_cache_key_from_context(func, args, kwargs)

    def serialize(self, value: BaseModel) -> dict[str, Any]:
        return value.model_dump()

    def deserialize(self, data: JSON_Serializable, value_type: type[BaseModel]) -> BaseModel:
        if not isinstance(data, dict):
            raise TypeError(f"Expected dict for BaseModel deserialization, got {type(data)}")

        return value_type.model_validate(data)


class DataclassCacheTypeExtension(ICacheTypeExtension[Any]):
    def get_cache_key(self, func: Callable, args: tuple, kwargs: dict) -> str:
        return _make_cache_key_from_context(func, args, kwargs)

    def serialize(self, value: Any) -> dict[str, Any]:
        if not is_dataclass(value):
            raise TypeError(f"{value} is not a dataclass instance")
        return asdict(value)  # type: ignore

    def deserialize(self, data: JSON_Serializable, value_type: type) -> Any:
        if not isinstance(data, dict):
            raise TypeError(f"Expected dict for dataclass deserialization, got {type(data)}")

        if not is_dataclass(value_type):
            raise TypeError(f"{value_type} is not a dataclass")

        return value_type(**data)


class PrimitiveCacheTypeExtension(ICacheTypeExtension[JSON_Serializable]):
    def get_cache_key(self, func: Callable, args: tuple, kwargs: dict) -> str:
        return _make_cache_key_from_context(func, args, kwargs)

    def serialize(self, value: Any) -> JSON_Serializable:
        return value

    def deserialize(self, data: JSON_Serializable, value_type: type) -> Any:
        return data


# TBD: class QuerySetCacheTypeExtension(ICacheTypeExtension[str, QuerySet]):


class CacheTypeExtensionRegistry:
    def __init__(
        self,
        extensions: dict[type | str, ICacheTypeExtension],
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
            return self._extensions["dataclass"]

        if self._is_primitive_serializable_type(extension_type):
            return self._extensions["primitive"]

        raise TypeError(f"No cache extension registered for type: {extension_type}")

    def _is_primitive_serializable_type(self, extension_type: type) -> bool:
        return extension_type in (int, float, str, bool, list, dict, type(None))
