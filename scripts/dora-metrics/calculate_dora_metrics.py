#!/usr/bin/env python3
"""Calculate DORA metrics from workflow run data."""

import re
from datetime import datetime, timezone
from typing import TypedDict


class WorkflowRun(TypedDict):
    run_id: str
    commit_sha: str
    status: str
    conclusion: str
    created_at: datetime
    updated_at: datetime
    duration_minutes: float
    event: str


def parse_iso_timestamp(timestamp_str: str) -> datetime:
    timestamp_str = timestamp_str.strip()
    try:
        return datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
    except ValueError:
        return datetime.strptime(timestamp_str, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)


def parse_duration(time_str: str) -> float:
    minutes = 0.0
    seconds = 0.0

    if m := re.search(r"(\d+)m", time_str):
        minutes = float(m.group(1))
    if s := re.search(r"(\d+)s", time_str):
        seconds = float(s.group(1))

    return minutes + (seconds / 60.0)


def parse_table(file_path: str) -> list[WorkflowRun]:
    with open(file_path, "r") as f:
        lines = f.readlines()

    header_idx = next((i for i, line in enumerate(lines) if "Run ID" in line and "Conclusion" in line), None)
    if header_idx is None:
        raise ValueError("Table header not found")

    runs: list[WorkflowRun] = []
    for line in lines[header_idx + 2:]:
        if not line.strip() or not line.startswith("|"):
            continue

        parts = [p.strip() for p in line.split("|")]
        if len(parts) < 9:
            continue

        try:
            runs.append({
                "run_id": parts[1],
                "commit_sha": parts[2],
                "status": parts[3],
                "conclusion": parts[4],
                "created_at": parse_iso_timestamp(parts[5]),
                "updated_at": parse_iso_timestamp(parts[6]),
                "duration_minutes": parse_duration(parts[7]),
                "event": parts[8],
            })
        except (IndexError, ValueError):
            continue

    return runs


def deployment_frequency(runs: list[WorkflowRun]) -> float:
    successful = [r for r in runs if r["conclusion"] == "Success" and r["status"] == "completed"]

    if len(runs) < 2:
        return len(successful)

    timestamps = [r["created_at"] for r in runs]
    days = max((max(timestamps) - min(timestamps)).total_seconds() / 86400, 1.0)
    return len(successful) / (days / 7.0)


def lead_time(runs: list[WorkflowRun]) -> float:
    successful = [r for r in runs if r["conclusion"] == "Success" and r["status"] == "completed"]
    return sum(r["duration_minutes"] for r in successful) / len(successful) if successful else 0.0


def change_failure_rate(runs: list[WorkflowRun]) -> float:
    completed = [r for r in runs if r["status"] == "completed" and r["conclusion"] in ["Success", "Failure"]]
    if not completed:
        return 0.0
    failed = sum(1 for r in completed if r["conclusion"] == "Failure")
    return (failed / len(completed)) * 100.0


def time_to_restore(runs: list[WorkflowRun]) -> float:
    sorted_runs = sorted(runs, key=lambda r: r["created_at"])
    restore_times: list[float] = []

    for i, run in enumerate(sorted_runs):
        if run["conclusion"] == "Failure" and run["status"] == "completed":
            for next_run in sorted_runs[i + 1:]:
                if next_run["conclusion"] == "Success" and next_run["status"] == "completed":
                    restore_times.append((next_run["created_at"] - run["created_at"]).total_seconds() / 60.0)
                    break

    return sum(restore_times) / len(restore_times) if restore_times else 0.0


def format_duration(minutes: float) -> str:
    if minutes < 60:
        return f"{minutes:.1f}min"
    elif minutes < 1440:
        return f"{minutes/60:.1f}h"
    else:
        return f"{minutes/1440:.1f}d"


if __name__ == "__main__":
    import sys

    if len(sys.argv) != 2:
        print("Usage: python3 calculate_dora_metrics.py <metrics-raw.md>")
        sys.exit(1)

    runs = parse_table(sys.argv[1])

    if not runs:
        print("No records found")
        sys.exit(1)

    print(f"Deployment Frequency: {deployment_frequency(runs):.2f} deployments/week")
    print(f"Lead Time for Changes: {format_duration(lead_time(runs))}")
    print(f"Change Failure Rate: {change_failure_rate(runs):.1f}%")
    print(f"Time to Restore: {format_duration(time_to_restore(runs))}")
