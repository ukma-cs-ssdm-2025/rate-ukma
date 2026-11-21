import math
from enum import Enum
from typing import Self

from pydantic import BaseModel, ConfigDict, model_validator

# Effect's JSON codec spells non-finite numbers out as strings; Rate UKMA cannot
# store or forward them, so every generated model refuses them.
NON_FINITE_NUMBERS = frozenset({"Infinity", "-Infinity", "NaN"})


class UkmaDataModel(BaseModel):
    """Base for every model generated from UKMA Data's OpenAPI spec."""

    model_config = ConfigDict(populate_by_name=True)

    @model_validator(mode="after")
    def _reject_non_finite_numbers(self) -> Self:
        for value in self.__dict__.values():
            _reject_non_finite(value)
        return self


def _reject_non_finite(value: object) -> None:
    if isinstance(value, Enum):
        if value.value in NON_FINITE_NUMBERS:
            raise ValueError("UKMA Data numbers must be finite")
    elif isinstance(value, float):
        if not math.isfinite(value):
            raise ValueError("UKMA Data numbers must be finite")
    elif isinstance(value, dict):
        for item in value.values():
            _reject_non_finite(item)
    elif isinstance(value, list | tuple):
        for item in value:
            _reject_non_finite(item)
    elif isinstance(value, BaseModel):
        for item in value.__dict__.values():
            _reject_non_finite(item)
