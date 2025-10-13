from typing import Any, NewType, ParamSpec, Protocol, TypeVar, runtime_checkable

_P = ParamSpec("_P")
_RT = TypeVar("_RT", covariant=True)
_T = TypeVar("_T")
_K = TypeVar("_K")
_T_contra = TypeVar("_T_contra", contravariant=True)

Url = NewType("Url", str)


@runtime_checkable
class IProvider(Protocol[_P, _RT]):
    def provide(self, *args: _P.args, **kwargs: _P.kwargs) -> _RT: ...


@runtime_checkable
class IOperation(Protocol[_P]):
    def execute(self, *args: _P.args, **kwargs: _P.kwargs) -> None: ...


@runtime_checkable
class ICondition(Protocol[_P]):
    def check(self, *args: _P.args, **kwargs: _P.kwargs) -> bool: ...


@runtime_checkable
class IProcessor(Protocol[_P, _RT]):
    def process(self, *args: _P.args, **kwargs: _P.kwargs) -> _RT: ...


@runtime_checkable
class ISerializer(Protocol[_P, _RT]):
    def serialize(self, *args: _P.args, **kwargs: _P.kwargs) -> _RT: ...


@runtime_checkable
class ICloser(Protocol):
    def close(self) -> None: ...


@runtime_checkable
class ILock(Protocol):
    def acquire(self) -> bool: ...

    def release(self) -> bool: ...

    def locked(self) -> bool: ...

    def __enter__(self) -> None:
        acquired = self.acquire()
        if not acquired:
            raise RuntimeError("Failed to acquire lock")

    def __exit__(self, *args: Any, **kwargs: Any) -> None:
        released = self.release()
        if not released:
            raise RuntimeError("Failed to release lock")


@runtime_checkable
class IRunner(Protocol[_P]):
    def run(self, *args: _P.args, **kwargs: _P.kwargs) -> bool: ...


@runtime_checkable
class IReasonedCondition(ICondition[_P], Protocol):
    def check_with_reason(
        self, *args: _P.args, **kwargs: _P.kwargs
    ) -> tuple[bool, str]: ...


@runtime_checkable
class ILogger(ICloser, Protocol):
    def info(self, *args: Any, **kwargs: Any) -> None: ...

    def error(self, *args: Any, **kwargs: Any) -> None: ...

    def debug(self, *args: Any, **kwargs: Any) -> None: ...

    def warning(self, *args: Any, **kwargs: Any) -> None: ...


@runtime_checkable
class ITemplate(Protocol[_P, _RT]):
    def interpolate(self, *args: _P.args, **kwargs: _P.kwargs) -> _RT: ...


@runtime_checkable
class IMapper(Protocol[_T_contra, _RT]):
    def map(self, obj: _T_contra) -> _RT: ...


@runtime_checkable
class IBidirectionalMapper(Protocol[_T, _K]):
    def map_to(self, obj: _T) -> _K: ...
    def map_from(self, obj: _K) -> _T: ...


@runtime_checkable
class IService(Protocol):
    def start(self) -> None: ...

    def stop(self) -> None: ...


@runtime_checkable
class IFactory(Protocol[_P, _RT]):
    def create(self, *args: _P.args, **kwargs: _P.kwargs) -> _RT: ...


@runtime_checkable
class IEventListener(Protocol[_T_contra]):
    def on_event(self, event: _T_contra, *args: Any, **kwargs: Any) -> None: ...


@runtime_checkable
class IEventBus(Protocol[_T]):
    def publish(self, event: _T, *args: Any, **kwargs: Any) -> None: ...
    def subscribe(self, listener: IEventListener[_T]) -> None: ...


@runtime_checkable
class IObservable(Protocol[_T]):
    def add_observer(self, observer: IEventListener[_T]) -> None: ...
    def notify(self, event: _T, *args: Any, **kwargs: Any) -> None: ...
