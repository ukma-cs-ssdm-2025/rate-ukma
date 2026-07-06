from typing import Any, Protocol, runtime_checkable

from django.db.models.signals import ModelSignal


@runtime_checkable
class IModelSignalHandler[T_contra](Protocol):
    def handle_signal(self, instance: T_contra, *args: Any, **kwargs: Any) -> None: ...

    def connect(self, signal: ModelSignal) -> None: ...
