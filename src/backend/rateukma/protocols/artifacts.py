import threading
from typing import Any, Callable, Collection, List, ParamSpec, Type, TypeVar

from .decorators import implements
from .generic import (
    ICondition,
    IEventBus,
    IEventListener,
    ILock,
    ILogger,
    IOperation,
    IProvider,
)

_P = ParamSpec("_P")
_RT = TypeVar("_RT")
_RT2 = TypeVar("_RT2")
_T = TypeVar("_T")
_K = TypeVar("_K")


class FromCallableProvider(IProvider[_P, _RT]):
    def __init__(self, func: Callable[_P, _RT]):
        self.func = func

    @implements
    def provide(self, *args: _P.args, **kwargs: _P.kwargs) -> _RT:
        return self.func(*args, **kwargs)


class TypeInitializerProvider(IProvider[..., _T]):
    def __init__(self, _type: Type[_T]):
        self._type = _type

    @implements
    def provide(self, *args, **kwargs) -> _T:
        return self._type(*args, **kwargs)


class WithLockProvider(IProvider[_P, _RT]):
    def __init__(self, provider: IProvider[_P, _RT], lock: ILock):
        self.provider = provider
        self.lock = lock

    @implements
    def provide(self, *args: _P.args, **kwargs: _P.kwargs) -> _RT:
        if not self.lock.acquire():
            raise RuntimeError("Lock not acquired")
        try:
            return self.provider.provide(*args, **kwargs)
        finally:
            self.lock.release()


class FromCallableOperation(IOperation[_P]):
    def __init__(self, func: Callable[_P, Any]):
        self.func = func

    @implements
    def execute(self, *args: _P.args, **kwargs: _P.kwargs) -> None:
        self.func(*args, **kwargs)


class CompositeCondition(ICondition[_P]):
    def __init__(self, conditions: Collection[ICondition[_P]]):
        self.conditions = conditions

    @implements
    def check(self, *args: _P.args, **kwargs: _P.kwargs) -> bool:
        return all(condition.check(*args, **kwargs) for condition in self.conditions)


class AnyCondition(ICondition[_P]):
    def __init__(self, conditions: Collection[ICondition[_P]]):
        self.conditions = conditions

    @implements
    def check(self, *args: _P.args, **kwargs: _P.kwargs) -> bool:
        return any(condition.check(*args, **kwargs) for condition in self.conditions)


class CompositeOperation(IOperation[_P]):
    def __init__(self, operations: Collection[IOperation[_P]]):
        self.operations = operations

    @implements
    def execute(self, *args: _P.args, **kwargs: _P.kwargs) -> None:
        for operation in self.operations:
            operation.execute(*args, **kwargs)


class StrategySelector(IProvider[_P, _RT]):
    def __init__(self, strategies: Collection[tuple[ICondition[_P], _RT]]):
        self.strategies = strategies

    @implements
    def provide(self, *args: _P.args, **kwargs: _P.kwargs) -> _RT:
        return self.select_strategy(*args, **kwargs)

    def select_strategy(self, *args: _P.args, **kwargs: _P.kwargs) -> _RT:
        for condition, strategy in self.strategies:
            if condition.check(*args, **kwargs):
                return strategy
        raise RuntimeError("No strategy found")


class PrefixLoggerWrapper(ILogger):
    def __init__(self, logger: ILogger, prefix: str = ""):
        self.logger = logger
        self.prefix = prefix

    @implements
    def info(self, message: str, *args, **kwargs):
        self.logger.info(f"{self._append_prefix(message)}", *args, **kwargs)

    @implements
    def error(self, message: str, *args, **kwargs):
        self.logger.error(f"{self._append_prefix(message)}", *args, **kwargs)

    @implements
    def warning(self, message: str, *args, **kwargs):
        self.logger.warning(f"{self._append_prefix(message)}", *args, **kwargs)

    @implements
    def debug(self, message: str, *args, **kwargs):
        self.logger.debug(f"{self._append_prefix(message)}", *args, **kwargs)

    @implements
    def close(self) -> None:
        self.logger.close()

    def _append_prefix(self, message: str):
        return f"{self.prefix}{message}"


class ThreadedOperation(IOperation[_P]):
    def __init__(
        self,
        operation_to_run: IOperation[_P],
    ):
        self.operation_to_run = operation_to_run

    @implements
    def execute(self, *args: _P.args, **kwargs: _P.kwargs) -> None:
        thread = threading.Thread(
            target=self.operation_to_run.execute,
            args=args,
            kwargs=kwargs,
        )
        thread.daemon = True
        thread.start()


class LambdaCondition(ICondition[_P]):
    def __init__(self, condition_func: Callable[_P, bool]):
        self.condition_func = condition_func

    @implements
    def check(self, *args: _P.args, **kwargs: _P.kwargs) -> bool:
        return self.condition_func(*args, **kwargs)


class EventBus(IEventBus[_T]):
    def __init__(self, listeners: List[IEventListener[_T]]):
        self.listeners = listeners

    @implements
    def subscribe(self, listener: IEventListener[_T]) -> None:
        self.listeners.append(listener)

    @implements
    def publish(self, event: _T, *args: Any, **kwargs: Any) -> None:
        for listener in self.listeners:
            listener.on_event(event, *args, **kwargs)
