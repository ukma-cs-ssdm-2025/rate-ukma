from abc import ABC, abstractmethod
from typing import Any, TypeVar

T = TypeVar("T")
U = TypeVar("U")
V = TypeVar("V")


class DataValidationError(Exception):
    """Exception raised when data validation fails during deduplication processing."""

    pass


class Extractor[T, U](ABC):
    @abstractmethod
    def extract(self, data: T) -> U:
        pass


class DeduplicationComponent[T, U](ABC):
    @abstractmethod
    def process(self, data: T) -> U:
        pass


class ProcessingStep[T, U]:
    def __init__(self, processor: DeduplicationComponent[T, U]):
        self.processor = processor

    def execute(self, data: T) -> U:
        return self.processor.process(data)


class ProcessingChain[T, U]:
    def __init__(self, steps: list[ProcessingStep[Any, Any]] | None = None):
        self._steps: list[ProcessingStep[Any, Any]] = steps.copy() if steps else []

    def add_step[V](self, processor: DeduplicationComponent[U, V]) -> "ProcessingChain[T, V]":
        step = ProcessingStep(processor)
        new_steps = self._steps.copy()
        new_steps.append(step)
        return ProcessingChain[T, V](new_steps)

    def execute(self, data: T) -> U:
        if not self._steps:
            raise ValueError("Cannot execute empty processing chain")

        current_data: Any = data

        for step in self._steps:
            current_data = step.execute(current_data)

        return current_data
