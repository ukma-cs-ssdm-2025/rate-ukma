"""DORA metrics domain model and report generation."""

from datetime import datetime, timedelta, timezone
from typing import Optional

from chart_builder import MermaidChartBuilder, PieChartBuilder
from constants import (
    CHANGE_FAILURE_RATE_ELITE,
    CHANGE_FAILURE_RATE_HIGH,
    CHANGE_FAILURE_RATE_MEDIUM,
    CHART_Y_AXIS_PADDING,
    CONCLUSION_FAILURE,
    CONCLUSION_SUCCESS,
    CONSISTENCY_HIGH_THRESHOLD,
    CONSISTENCY_MEDIUM_THRESHOLD,
    SECONDS_PER_DAY,
    STATUS_COMPLETED,
)
from dora_metrics_classifier import (
    classify_change_failure_rate,
    classify_deployment_frequency,
    classify_lead_time,
    classify_time_to_restore,
)
from parse_dora_metrics import WorkflowRun
from weekly_aggregator import WeeklyAggregator, WeeklyData


def format_duration(minutes: float) -> str:
    if minutes < 60.0:
        total_seconds = int(round(minutes * 60.0))
        whole_minutes = total_seconds // 60
        seconds = total_seconds % 60
        return f"{whole_minutes}m {seconds}s"

    if minutes < 1440.0:
        total_minutes = int(round(minutes))
        hours = total_minutes // 60
        rem_minutes = total_minutes % 60
        return f"{hours}h {rem_minutes}m"

    total_minutes = int(round(minutes))
    days = total_minutes // 1440
    rem_minutes = total_minutes % 1440
    hours = rem_minutes // 60
    return f"{days}d {hours}h"


def _is_success(run: WorkflowRun) -> bool:
    """Check if a run completed successfully."""
    return (
        run.get("status") == STATUS_COMPLETED
        and str(run.get("conclusion", "")).lower() == CONCLUSION_SUCCESS
    )


def _is_failure(run: WorkflowRun) -> bool:
    """Check if a run failed."""
    return str(run.get("conclusion", "")).lower() == CONCLUSION_FAILURE


class DORAMetrics:
    def __init__(self, runs: list[WorkflowRun]):
        self.runs = runs
        self._weekly_runs: Optional[list[WorkflowRun]] = None
        self._successful_runs: Optional[list[WorkflowRun]] = None
        self._failed_runs: Optional[list[WorkflowRun]] = None

    @property
    def weekly_runs(self) -> list[WorkflowRun]:
        if self._weekly_runs is None:
            week_ago = datetime.now(timezone.utc) - timedelta(days=7)
            self._weekly_runs = [r for r in self.runs if r["created_at"] >= week_ago]
        return self._weekly_runs

    @property
    def successful_runs(self) -> list[WorkflowRun]:
        if self._successful_runs is None:
            self._successful_runs = [r for r in self.weekly_runs if _is_success(r)]
        return self._successful_runs

    @property
    def failed_runs(self) -> list[WorkflowRun]:
        if self._failed_runs is None:
            self._failed_runs = [r for r in self.weekly_runs if _is_failure(r)]
        return self._failed_runs

    @property
    def other_runs(self) -> list[WorkflowRun]:
        return [
            r for r in self.weekly_runs if not _is_success(r) and not _is_failure(r)
        ]

    def deployment_frequency(self) -> float:
        """Calculate deployment frequency (deployments per week)."""
        if len(self.weekly_runs) < 2:
            return len(self.successful_runs)

        timestamps = [r["created_at"] for r in self.weekly_runs]
        days = max(
            (max(timestamps) - min(timestamps)).total_seconds() / SECONDS_PER_DAY,
            1.0,
        )
        return len(self.successful_runs) / (days / 7.0)

    def lead_time(self) -> float:
        """Calculate average lead time in minutes."""
        if not self.successful_runs:
            return 0.0
        return sum(r["duration_minutes"] for r in self.successful_runs) / len(
            self.successful_runs
        )

    def change_failure_rate(self) -> float:
        """Calculate change failure rate as percentage."""
        completed = [r for r in self.weekly_runs if _is_success(r) or _is_failure(r)]
        if not completed:
            return 0.0
        failed_count = sum(1 for r in completed if _is_failure(r))
        return (failed_count / len(completed)) * 100.0

    def time_to_restore(self) -> float:
        """Calculate average time to restore service in minutes."""
        sorted_runs = sorted(self.runs, key=lambda r: r["created_at"])
        restore_times: list[float] = []

        for i, run in enumerate(sorted_runs):
            if _is_failure(run):
                for next_run in sorted_runs[i + 1 :]:
                    if _is_success(next_run):
                        restore_time = (
                            next_run["created_at"] - run["created_at"]
                        ).total_seconds() / 60.0
                        restore_times.append(restore_time)
                        break

        return sum(restore_times) / len(restore_times) if restore_times else 0.0

    def generate_outcomes_chart(self) -> str:
        """Generate pie chart of workflow run outcomes."""
        return (
            PieChartBuilder()
            .title("Workflow Run Outcomes")
            .add_slice("Success", len(self.successful_runs))
            .add_slice("Failure", len(self.failed_runs))
            .add_slice("Other", len(self.other_runs))
            .build()
        )

    def generate_lead_time_trend(self) -> str:
        """Generate weekly lead time trend chart with statistics table."""
        weekly_data = WeeklyAggregator.group_by_week(self.runs, filter_fn=_is_success)

        if not weekly_data:
            return ""

        max_avg = max(w.avg_duration for w in weekly_data)

        chart = (
            MermaidChartBuilder()
            .title("Average Lead Time by Week")
            .x_axis([w.week_label for w in weekly_data])
            .y_axis("Duration (minutes)", max_val=max_avg * CHART_Y_AXIS_PADDING)
            .bar_data([w.avg_duration for w in weekly_data])
            .build()
        )

        table = self._build_lead_time_table(weekly_data)

        return f"{chart}\n\n{table}"

    def generate_frequency_trend(self) -> str:
        """Generate deployment frequency trend chart with cadence analysis."""
        weekly_data = WeeklyAggregator.group_by_week(self.runs, filter_fn=_is_success)

        if not weekly_data:
            return ""

        max_count = max(w.count for w in weekly_data)

        chart = (
            MermaidChartBuilder()
            .title("Deployment Frequency Trend")
            .x_axis([w.week_label for w in weekly_data])
            .y_axis("Number of Deployments", max_val=max_count * CHART_Y_AXIS_PADDING)
            .bar_data([float(w.count) for w in weekly_data])
            .build()
        )

        analysis = self._build_cadence_analysis(weekly_data)

        return f"{chart}\n\n{analysis}"

    def generate_failure_rate_trend(self) -> str:
        """Generate change failure rate trend chart with DORA tier reference."""
        weekly_data = WeeklyAggregator.group_by_week(self.runs)

        if not weekly_data:
            return ""

        chart = (
            MermaidChartBuilder()
            .title("Change Failure Rate Trend")
            .x_axis([w.week_label for w in weekly_data])
            .y_axis("Failure Rate (%)", max_val=100)
            .bar_data([w.failure_rate for w in weekly_data])
            .build()
        )

        table = self._build_failure_rate_table(weekly_data)

        tiers = (
            "\n**DORA Performance Tiers:**\n"
            f"- Elite: ≤ {CHANGE_FAILURE_RATE_ELITE:.0f}%\n"
            f"- High: {CHANGE_FAILURE_RATE_ELITE + 1:.0f}-{CHANGE_FAILURE_RATE_HIGH:.0f}%\n"
            f"- Medium: {CHANGE_FAILURE_RATE_HIGH + 1:.0f}-{CHANGE_FAILURE_RATE_MEDIUM:.0f}%\n"
            f"- Low: > {CHANGE_FAILURE_RATE_MEDIUM:.0f}%"
        )

        return f"{chart}\n\n{table}{tiers}"

    # Report generation

    def generate_report(self) -> str:
        """Generate complete DORA metrics markdown report."""
        sections = [
            self._generate_header(),
            self._generate_summary_table(),
            self._generate_statistics(),
            "---",
            "## Visualizations",
            "### Workflow Outcomes",
            self.generate_outcomes_chart(),
            "### Lead Time Trend",
            self.generate_lead_time_trend(),
            "### Deployment Frequency Trend",
            self.generate_frequency_trend(),
            "### Change Failure Rate Trend",
            self.generate_failure_rate_trend(),
        ]

        return "\n\n".join(filter(None, sections))

    # Private helper methods

    def _generate_header(self) -> str:
        """Generate report header."""
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        return f"# DORA Metrics Report\n\n**Generated:** {timestamp}"

    def _generate_summary_table(self) -> str:
        """Generate core metrics summary table."""
        freq = self.deployment_frequency()
        lt = self.lead_time()
        cfr = self.change_failure_rate()
        ttr = self.time_to_restore()

        header = "## Summary\n\n|Metric|Value|Category|"
        separator = "| --- | --- | --- |"
        rows = (
            f"| Deployment Frequency | {freq:.2f}/week | {classify_deployment_frequency(freq)} |\n"
            f"| Lead Time for Changes | {format_duration(lt)} | {classify_lead_time(lt)} |\n"
            f"| Change Failure Rate | {cfr:.1f}% | {classify_change_failure_rate(cfr)} |\n"
            f"| Time to Restore | {format_duration(ttr)} | {classify_time_to_restore(ttr)} |"
        )

        return f"{header}\n{separator}\n{rows}"

    def _generate_statistics(self) -> str:
        """Generate run statistics summary."""
        total = len(self.weekly_runs)
        if total == 0:
            return ""

        success_count = len(self.successful_runs)
        failed_count = len(self.failed_runs)
        other_count = len(self.other_runs)

        success_pct = (success_count / total) * 100
        failed_pct = (failed_count / total) * 100
        other_pct = (other_count / total) * 100

        parts = [
            f"**Total Runs:** {total}",
            f"**Successful:** {success_count} ({success_pct:.1f}%)",
            f"**Failed:** {failed_count} ({failed_pct:.1f}%)",
        ]

        if other_count > 0:
            parts.append(f"**Other:** {other_count} ({other_pct:.1f}%)")

        return " | ".join(parts)

    def _build_lead_time_table(self, weekly_data: list[WeeklyData]) -> str:
        """Build lead time statistics table."""
        lines = [
            "| Week Starting | Avg Lead Time | Deployments |",
            "|---------------|---------------|-------------|",
        ]

        for week in weekly_data:
            avg_str = format_duration(week.avg_duration)
            lines.append(f"| {week.week_label} | {avg_str} | {week.count} |")

        return "\n".join(lines)

    def _build_cadence_analysis(self, weekly_data: list[WeeklyData]) -> str:
        """Build deployment cadence analysis."""
        counts = [w.count for w in weekly_data]
        total_deployments = sum(counts)
        avg_per_week = total_deployments / len(weekly_data) if weekly_data else 0
        min_count = min(counts) if counts else 0
        max_count = max(counts) if counts else 0

        # Calculate consistency
        variance = (
            sum((count - avg_per_week) ** 2 for count in counts) / len(counts)
            if counts
            else 0
        )
        std_dev = variance**0.5

        if avg_per_week > 0:
            relative_std = std_dev / avg_per_week
            if relative_std < CONSISTENCY_HIGH_THRESHOLD:
                consistency = "High (stable release cadence)"
            elif relative_std < CONSISTENCY_MEDIUM_THRESHOLD:
                consistency = "Medium (some variability)"
            else:
                consistency = "Low (irregular release pattern)"
        else:
            consistency = "N/A"

        return (
            "**Deployment Cadence Analysis:**\n"
            f"- **Average per week:** {avg_per_week:.1f} deployments\n"
            f"- **Most active week:** {max_count} deployments\n"
            f"- **Least active week:** {min_count} deployments\n"
            f"- **Consistency:** {consistency}"
        )

    def _build_failure_rate_table(self, weekly_data: list[WeeklyData]) -> str:
        """Build change failure rate statistics table."""
        lines = [
            "| Week Starting | Total Runs | Failed | CFR |",
            "|---------------|------------|--------|-----|",
        ]

        for week in weekly_data:
            lines.append(
                f"| {week.week_label} | {week.total_runs} | "
                f"{week.failed_runs} | {week.failure_rate:.1f}% |"
            )

        return "\n".join(lines)
