"""Weekly data aggregation utilities for DORA metrics."""

from collections import defaultdict
from dataclasses import dataclass
from datetime import timedelta
from typing import Callable, Optional

from constants import CONCLUSION_FAILURE, STATUS_COMPLETED
from parse_dora_metrics import WorkflowRun


@dataclass
class WeeklyData:
    """Aggregated data for a single week."""

    week_key: str
    week_label: str
    runs: list[WorkflowRun]

    @property
    def count(self) -> int:
        """Number of runs in this week."""
        return len(self.runs)

    @property
    def avg_duration(self) -> float:
        """Average duration of runs in minutes."""
        if not self.runs:
            return 0.0
        return sum(r["duration_minutes"] for r in self.runs) / len(self.runs)

    @property
    def total_runs(self) -> int:
        """Total number of runs (alias for count)."""
        return self.count

    @property
    def failed_runs(self) -> int:
        """Number of failed runs."""
        return sum(
            1
            for r in self.runs
            if r.get("status") == STATUS_COMPLETED
            and str(r.get("conclusion", "")).lower() == CONCLUSION_FAILURE
        )

    @property
    def failure_rate(self) -> float:
        """Failure rate as percentage."""
        if not self.runs:
            return 0.0
        return (self.failed_runs / self.count) * 100.0


class WeeklyAggregator:
    """Aggregates workflow runs by week."""

    @staticmethod
    def group_by_week(
        runs: list[WorkflowRun],
        filter_fn: Optional[Callable[[WorkflowRun], bool]] = None,
    ) -> list[WeeklyData]:
        filtered_runs = runs if filter_fn is None else [r for r in runs if filter_fn(r)]

        if not filtered_runs:
            return []

        weekly_data: dict[tuple[str, str], list[WorkflowRun]] = defaultdict(list)

        for run in filtered_runs:
            week_start = run["created_at"] - timedelta(days=run["created_at"].weekday())
            week_key = week_start.strftime("%Y-W%W")
            week_label = week_start.strftime("%b %d")

            weekly_data[(week_key, week_label)].append(run)

        result = [
            WeeklyData(week_key=key, week_label=label, runs=runs_list)
            for (key, label), runs_list in weekly_data.items()
        ]

        return sorted(result, key=lambda w: w.week_key)
