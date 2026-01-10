import threading
from collections.abc import Callable
from functools import wraps
from typing import TypeGuard


class NotSetType:
    pass


NOT_SET = NotSetType()


def _is_set[RT](value: RT | NotSetType) -> TypeGuard[RT]:
    return value is not NOT_SET


def once[**P, RT](func: Callable[P, RT]) -> Callable[P, RT]:
    """
    Decorator that ensures a function is called only once. The result is cached and
    returned on subsequent calls. It is thread-safe.

    It is possible for the target func to be called more than once upon specific
    requirements in race condition, but the result will still be cached and returned.

    Args:
        func (Callable[_P, _RT]): The function to decorate.

    Returns:
        Callable[_P, _RT]: The decorated function.
    """
    result: RT | NotSetType = NOT_SET
    called = False
    _lock = threading.RLock()

    @wraps(func)
    def wrapper(*args: P.args, **kwargs: P.kwargs) -> RT:
        nonlocal result, called

        with _lock:
            if _is_set(result):
                return result

            if called:
                raise RuntimeError(
                    f"Circular dependency detected while initializing: {func.__name__}"
                )

            called = True
            try:
                result = func(*args, **kwargs)
            finally:
                called = False

        return result

    return wrapper
