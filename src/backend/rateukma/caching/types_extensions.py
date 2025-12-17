import json
from collections.abc import Callable
from dataclasses import is_dataclass
from typing import Any, Protocol, TypeVar, get_origin

from django.db.models import Model
from django.forms.models import model_to_dict
from rest_framework.request import Request
from rest_framework.response import Response

from pydantic import BaseModel, TypeAdapter

from .cache_manager import CacheJsonDataEncoder, JSON_Serializable

V = TypeVar("V")
JSONValue = JSON_Serializable


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

    params_str = json.dumps(params_dict, sort_keys=True, cls=CacheJsonDataEncoder)
    return f"{func_name}:{params_str}"


class ICacheTypeExtension[V](Protocol):
    """
    Cache type extension that handles serialization/deserialization
    and cache key generation from function context
    """

    def get_cache_key(self, func: Callable, args: tuple, kwargs: dict) -> str: ...
    def serialize(self, value: V, value_type: type[V]) -> JSONValue: ...
    def deserialize(self, data: JSONValue, value_type: type[V]) -> V: ...


class TypeAdapterCacheExtension(ICacheTypeExtension[Any]):
    def get_cache_key(self, func: Callable, args: tuple, kwargs: dict) -> str:
        return _make_cache_key_from_context(func, args, kwargs)

    def serialize(self, value: Any, value_type: type[Any]) -> JSONValue:
        adapter = self._adapter_for(value_type)
        return adapter.dump_python(value)

    def deserialize(self, data: JSONValue, value_type: type[Any]) -> Any:
        adapter = self._adapter_for(value_type)
        return adapter.validate_python(data)

    def _adapter_for(self, value_type: type[Any]) -> TypeAdapter[Any]:
        return TypeAdapter(value_type)


class DRFResponseCacheTypeExtension(ICacheTypeExtension[Response]):
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
            return _make_cache_key_from_context(func, args, kwargs)

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
            params_key = _make_cache_key_from_context(func, filtered_args, kwargs)
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


class DjangoModelCacheTypeExtension(ICacheTypeExtension[Model]):
    def get_cache_key(self, func: Callable, args: tuple, kwargs: dict) -> str:
        return _make_cache_key_from_context(func, args, kwargs)

    def serialize(self, value: Model, value_type: type[Model]) -> JSONValue:
        return model_to_dict(value)

    def deserialize(self, data: JSONValue, value_type: type[Model]) -> Model:
        if not isinstance(data, dict):
            raise TypeError(f"Expected dict for DjangoModel deserialization, got {type(data)}")
        instance = value_type(**data)
        pk_name = value_type._meta.pk.attname  # type: ignore[attr-defined]
        if pk_name in data:
            instance.pk = data[pk_name]
        return instance


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

        if isinstance(candidate_type, type) and issubclass(candidate_type, Model):
            return self._extensions[Model]

        if is_dataclass(candidate_type) or self._is_typeadapter_supported_type(candidate_type):
            return self._generic

        raise TypeError(f"No cache extension registered for type: {extension_type}")

    def _is_typeadapter_supported_type(self, extension_type: type) -> bool:
        return extension_type in self.TYPEADAPTER_SUPPORTED_TYPES
