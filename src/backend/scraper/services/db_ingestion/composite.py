from collections.abc import Collection
from pathlib import Path
from typing import Any

from rateukma.protocols.artifacts import ProviderChain
from rateukma.protocols.decorators import implements
from rateukma.protocols.generic import IProvider


class CoursesDeltaIngestion(ProviderChain):
    def __init__(self, providers: Collection[IProvider[Any, Any]]):
        self.providers = providers

    @implements
    def provide(self, file_path: Path | str, batch_size: int = 100) -> None:
        super().provide(file_path, batch_size)
