"""Errors a sync run raises before it records any change."""

from __future__ import annotations

from collections.abc import Sequence


class ShortReadError(RuntimeError):
    """UKMA Data returned under 90% of what Rate UKMA holds for a year."""

    def __init__(self, years: Sequence[int]) -> None:
        self.years = list(years)
        super().__init__("short_read")


class StalledReadError(RuntimeError):
    """UKMA Data said there is more but its cursor did not move."""
