import json
from collections.abc import Callable
from dataclasses import asdict, is_dataclass
from typing import Any, Protocol, TypeVar, get_origin

from rest_framework.request import Request
from rest_framework.response import Response

from pydantic import BaseModel, TypeAdapter

from ..protocols.generic import IProvider
from .cache_manager import CacheJsonDataEncoder, JSON_Serializable

V = TypeVar("V")
JSONValue = JSON_Serializable


class CacheKeyContextProvider(IProvider[[Callable, tuple, dict], str]):
    def provide(self, func: Callable, args: tuple, kwargs: dict) -> str:
        return self._make_cache_key_from_context(func, args, kwargs)

    def _make_cache_key_from_context(self, func: Callable, args: tuple, kwargs: dict) -> str:
        func_name = f"{func.__module__}.{func.__qualname__}"

        params_dict = self._parse_args(args)
        params_dict.update(self._parse_kwargs(kwargs))

        params_str = json.dumps(params_dict, sort_keys=True, cls=CacheJsonDataEncoder)
        return f"{func_name}:{params_str}"

    def _parse_args(self, args: tuple) -> dict[str, Any]:
        return {f"arg_{i}": self._normalize_value(arg) for i, arg in enumerate(args)}

    def _parse_kwargs(self, kwargs: dict) -> dict[str, Any]:
        params_dict: dict[str, Any] = {}
        for key, val in kwargs.items():
            if key in {"self", "cls", "request"}:
                continue
            normalized = self._normalize_value(val)
            if normalized is not None:
                params_dict[key] = normalized
        return params_dict

    def _normalize_value(self, value: Any) -> Any:
        # serialize function parameters to JSON
        if isinstance(value, BaseModel):
            return value.model_dump(mode="python", by_alias=True)
        if is_dataclass(value) and not isinstance(value, type):
            return asdict(value)
        # skip objects with complex state to avoid unstable repr
        if hasattr(value, "__dict__") and not isinstance(
            value, (str | int | float | bool | list | dict | tuple)
        ):
            return None
        return repr(value)


class ICacheTypeExtension[V](Protocol):
    """
    Cache type extension that handles serialization/deserialization
    and cache key generation from function context
    """

    def get_cache_key(self, func: Callable, args: tuple, kwargs: dict) -> str: ...
    def serialize(self, value: V, value_type: type[V]) -> JSONValue: ...
    def deserialize(self, data: JSONValue, value_type: type[V]) -> V: ...


class TypeAdapterCacheExtension(ICacheTypeExtension[Any]):
    def __init__(self, cache_key_provider: CacheKeyContextProvider):
        self._cache_key_provider = cache_key_provider

    def get_cache_key(self, func: Callable, args: tuple, kwargs: dict) -> str:
        return self._cache_key_provider.provide(func, args, kwargs)

    def serialize(self, value: Any, value_type: type[Any]) -> JSONValue:
        adapter = self._adapter_for(value_type)
        return adapter.dump_python(value)

    def deserialize(self, data: JSONValue, value_type: type[Any]) -> Any:
        adapter = self._adapter_for(value_type)
        return adapter.validate_python(data)

    def _adapter_for(self, value_type: type[Any]) -> TypeAdapter[Any]:
        return TypeAdapter(value_type)


class DRFResponseCacheTypeExtension(ICacheTypeExtension[Response]):
    def __init__(self, cache_key_provider: CacheKeyContextProvider):
        self._cache_key_provider = cache_key_provider

    def get_cache_key(self, func: Callable, args: tuple, kwargs: dict) -> str:
        request = None
        request_index = None
        for i, arg in enumerate(args):
            if isinstance(arg, Request):
                request = arg
                request_index = i
                break

        func_name = f"{func.__module__}.{func.__qualname__}"

        if request is None:
            return self._cache_key_provider.provide(func, args, kwargs)

        query_string = "&".join(f"{k}={v}" for k, v in sorted(request.query_params.items()))
        path_with_query = (
            f"{request.method}:{request.path}?{query_string}"
            if query_string
            else f"{request.method}:{request.path}"
        )

        filtered_args = args
        if request_index is not None:
            filtered_args = args[:request_index] + args[request_index + 1 :]

        if filtered_args or kwargs:
            params_key = self._cache_key_provider.provide(func, filtered_args, kwargs)
            params_part = params_key[len(func_name) + 1 :]
            return f"{func_name}:{path_with_query}:{params_part}"
        else:
            return f"{func_name}:{path_with_query}"

    def serialize(
        self, value: Response, value_type: type[Response] | None = None
    ) -> JSON_Serializable:
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


class CacheTypeExtensionRegistry:
    TYPEADAPTER_SUPPORTED_TYPES = [int, float, str, bool, list, dict, tuple, type(None), BaseModel]

    def __init__(
        self,
        custom_extensions: dict[type, ICacheTypeExtension],
        generic_extension: ICacheTypeExtension[Any],
    ):
        self._extensions = custom_extensions
        self._generic = generic_extension

    def register(self, value_type: type, extension: ICacheTypeExtension) -> None:
        self._extensions[value_type] = extension

    def get_extension(self, extension_type: type) -> ICacheTypeExtension:
        origin = get_origin(extension_type)
        candidate_type = origin or extension_type

        if isinstance(candidate_type, type) and candidate_type in self._extensions:
            return self._extensions[candidate_type]

        if is_dataclass(candidate_type) or self._is_typeadapter_supported_type(candidate_type):
            return self._generic

        raise TypeError(f"No cache extension registered for type: {extension_type}")

    def _is_typeadapter_supported_type(self, extension_type: type) -> bool:
        return extension_type in self.TYPEADAPTER_SUPPORTED_TYPES
