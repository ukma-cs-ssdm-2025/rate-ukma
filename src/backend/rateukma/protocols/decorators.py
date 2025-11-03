import dis
import sys
from collections.abc import Callable
from types import FrameType
from typing import ParamSpec, TypeVar

_P = ParamSpec("_P")
_RT = TypeVar("_RT", covariant=True)


def _get_base_classes(frame: FrameType, namespace: dict) -> list[type]:
    return [
        _get_base_class(class_name_components, namespace)
        for class_name_components in _get_base_class_names(frame)
    ]


def _is_load_name_or_global(opname: str) -> bool:
    """Check if instruction is LOAD_NAME or LOAD_GLOBAL"""
    return opname in ["LOAD_NAME", "LOAD_GLOBAL"]


def _process_load_instruction(
    instruction, current_item: list[str], items: list[list[str]]
) -> list[str]:
    """Process LOAD_NAME/LOAD_GLOBAL instruction and return new current_item"""
    if current_item:
        items.append(current_item)
    return [instruction.argval]


def _process_load_attr(instruction, current_item: list[str]) -> list[str]:
    """Process LOAD_ATTR instruction and return updated current_item"""
    if current_item:
        current_item.append(instruction.argval)
    return current_item


def _process_other_instruction(
    current_item: list[str], items: list[list[str]]
) -> tuple[list[str], bool]:
    """Process other instructions and return (new_current_item, add_last_step)"""
    if current_item:
        items.append(current_item)
    return [], False


def _get_base_class_names(frame: FrameType) -> list[list[str]]:
    """Get baseclass names from the code object"""
    current_item: list[str] = []
    items: list[list[str]] = []
    add_last_step = True

    for instruction in dis.get_instructions(frame.f_code):
        if instruction.offset > frame.f_lasti:
            break
        if instruction.opcode not in dis.hasname:
            continue
        if not add_last_step:
            items = []
            add_last_step = True

        if _is_load_name_or_global(instruction.opname):
            current_item = _process_load_instruction(instruction, current_item, items)
        elif instruction.opname == "LOAD_ATTR":
            current_item = _process_load_attr(instruction, current_item)
        else:
            current_item, add_last_step = _process_other_instruction(current_item, items)

    if current_item:
        items.append(current_item)
    return items


def _get_base_class(components: list[str], namespace: dict) -> type:
    try:
        obj = namespace[components[0]]
    except KeyError:
        if isinstance(namespace["__builtins__"], dict):
            obj = namespace["__builtins__"][components[0]]
        else:
            obj = getattr(namespace["__builtins__"], components[0])
    for component in components[1:]:
        if hasattr(obj, component):
            obj = getattr(obj, component)
    return obj


def implements(method: Callable[_P, _RT]) -> Callable[_P, _RT]:
    """
    Decorator that verifies a method implements a protocol method.

    It checks if the method exists in any Protocol base class. If the method exists in
    multiple Protocol base classes, it raises an error. If the method doesn't exist in
    any Protocol base class, it raises an error as well. If the method exists in one of
    the implemented Protocols` parents, it is skipped and error is not raised - only direct
    parents of the given method class are checked for multiple implementation.

    It is important to include the protocol you are implementing at the end of the class bases:
    ```python
    class IStringProvider(Protocol):
        def provider(self) -> str:
            ...

    class UrlProvider(IStringProvider):
        @implements
        def provider(self) -> str:
            return "Hello, world!"

    # This will raise an error
    class GitHubUrlProvider(UrlProvider):
        @implements
        def provider(self) -> str:
            return "https://github.com"

    # This is correct
    class GitHubUrlProvider(UrlProvider, IStringProvider):
        @implements
        def provider(self) -> str:
            return "https://github.com"
    ```
    """
    method.__implements__ = True
    global_vars = getattr(method, "__globals__", None)
    if global_vars is None:
        global_vars = vars(sys.modules[method.__module__])
    method_implementation_found = False
    base_classes = _get_base_classes(sys._getframe(2), global_vars)
    direct_parents_count = 0

    for super_class in base_classes:
        if not hasattr(super_class, "_is_protocol") or not super_class._is_protocol:
            continue

        method_in_direct_parents = method.__name__ in super_class.__dict__
        method_in_all_parent_classes_tree = hasattr(super_class, method.__name__)

        if method_in_all_parent_classes_tree:
            method_implementation_found = True

        if method_in_direct_parents:
            direct_parents_count += 1
            if direct_parents_count > 1:
                raise TypeError(
                    f"{method.__qualname__}: multiple direct Protocols define '{method.__name__}'"
                )

    if not method_implementation_found:
        raise TypeError(f"{method.__qualname__}: no interface with the method name found")

    return method
