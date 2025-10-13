import threading
from functools import wraps
from typing import Callable, ParamSpec, TypeVar

_once_read_lock = threading.Lock()
_once_write_lock = threading.Lock()

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
    called = False
    result: _RT | NotSetType = NOT_SET

    @wraps(func)
    def wrapper(*args: _P.args, **kwargs: _P.kwargs) -> _RT:
        nonlocal called, result

        thread_called: bool
        with _once_read_lock:
            if called:
                thread_called = True
            else:
                called = True
                thread_called = False

        if thread_called:
            if result is NOT_SET or isinstance(result, NotSetType):
                raise RuntimeError(
                    f"Function was called more than once: {func.__name__}. Check if initialized services are not in circular dependency."
                )
            return result

        thread_result = func(*args, **kwargs)

        with _once_write_lock:
            called = True
            result = thread_result

        return result

    return wrapper
