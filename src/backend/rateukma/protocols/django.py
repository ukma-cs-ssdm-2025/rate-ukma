from typing import Any, Generic, Protocol, TypeVar, runtime_checkable

from django.db.models.signals import ModelSignal

_T = TypeVar("_T")
_T_co = TypeVar("_T_co", covariant=True)
_T_contra = TypeVar("_T_contra", contravariant=True)


@runtime_checkable
class IModelSignalHandler(Protocol, Generic[_T_contra]):
    def handle_signal(self, instance: _T_contra, *args: Any, **kwargs: Any) -> None: ...

    def connect(self, signal: ModelSignal) -> None: ...
