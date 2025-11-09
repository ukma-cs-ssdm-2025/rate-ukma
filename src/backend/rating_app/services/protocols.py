from typing import Any, Protocol


class IFilterable(Protocol):
    def get_filter_options(self) -> list[dict[str, Any]]: ...
