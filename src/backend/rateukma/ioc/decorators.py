import threading
from functools import wraps
from typing import Callable, ParamSpec, TypeVar, cast

_P = ParamSpec("_P")
_RT = TypeVar("_RT", covariant=True)


class NotSetType:
    pass


NOT_SET = NotSetType()


def once(func: Callable[_P, _RT]) -> Callable[_P, _RT]:
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
    result: _RT | NotSetType = NOT_SET
    called = False
    _lock = threading.RLock()

    @wraps(func)
    def wrapper(*args: _P.args, **kwargs: _P.kwargs) -> _RT:
        nonlocal result, called

        with _lock:
            if result is not NOT_SET:
                return cast(_RT, result)

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
