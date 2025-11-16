#!/usr/bin/env python3
"""
Calculate DORA metrics from markdown table data.
Outputs just the 4 metric values.
"""

import argparse
import re
from datetime import datetime, timezone
from typing import Dict, List, Tuple


def parse_iso_timestamp(timestamp_str: str) -> datetime:
    """Parse ISO 8601 timestamp to datetime object."""
    timestamp_str = timestamp_str.strip()
    try:
        return datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
    except ValueError:
        return datetime.strptime(timestamp_str, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)


def parse_time_duration(time_str: str) -> float:
    """Parse time string like '3m 48s' to minutes."""
    time_str = time_str.strip()
    minutes = 0.0
    seconds = 0.0

    m_match = re.search(r"(\d+)m", time_str)
    if m_match:
        minutes = float(m_match.group(1))

    s_match = re.search(r"(\d+)s", time_str)
    if s_match:
        seconds = float(s_match.group(1))

    return minutes + (seconds / 60.0)


def parse_markdown_table(file_path: str) -> List[Dict]:
    """Parse markdown table and return list of deployment records."""
    records = []

    with open(file_path, "r", encoding="utf-8") as f:
        lines = f.readlines()

    # Find table headers
    header_line = None
    for i, line in enumerate(lines):
        if "Run ID" in line and "Conclusion" in line:
            header_line = i
            break

    if header_line is None:
        raise ValueError("Could not find table header")

    # Parse data rows
    for i in range(header_line + 2, len(lines)):
        line = lines[i].strip()
        if not line or not line.startswith("|"):
            continue

        parts = [p.strip() for p in line.split("|")]
        if len(parts) < 9:
            continue

        try:
            run_id = parts[1].strip()
            commit_sha = parts[2].strip()
            status = parts[3].strip()
            conclusion = parts[4].strip()
            created_at_str = parts[5].strip()
            updated_at_str = parts[6].strip()
            time_duration = parts[7].strip()
            event = parts[8].strip()

            if not run_id or not status or not conclusion:
                continue

            created_at = parse_iso_timestamp(created_at_str)
            updated_at = parse_iso_timestamp(updated_at_str)
            duration_minutes = parse_time_duration(time_duration)

            records.append({
                "run_id": run_id,
                "commit_sha": commit_sha,
                "status": status,
                "conclusion": conclusion,
                "created_at": created_at,
                "updated_at": updated_at,
                "duration_minutes": duration_minutes,
                "event": event,
            })
        except (IndexError, ValueError):
            continue

    return records


def calculate_deployment_frequency(records: List[Dict]) -> float:
    """Calculate deployments per week."""
    successful = [r for r in records if r["conclusion"] == "Success" and r["status"] == "completed"]
    total_successful = len(successful)

    if len(records) < 1:
        return 0.0

    timestamps = [r["created_at"] for r in records]
    if len(timestamps) < 2:
        days = 1.0
    else:
        time_span = max(timestamps) - min(timestamps)
        days = max(time_span.total_seconds() / (60 * 60 * 24), 1.0)

    weeks = days / 7.0
    return total_successful / weeks


def calculate_lead_time(records: List[Dict]) -> float:
    """Calculate mean lead time in minutes."""
    successful = [r for r in records if r["conclusion"] == "Success" and r["status"] == "completed"]
    if not successful:
        return 0.0
    durations = [r["duration_minutes"] for r in successful]
    return sum(durations) / len(durations)


def calculate_change_failure_rate(records: List[Dict]) -> float:
    """Calculate failure rate percentage."""
    completed = [r for r in records if r["status"] == "completed" and r["conclusion"] in ["Success", "Failure"]]
    if not completed:
        return 0.0
    failed = len([r for r in completed if r["conclusion"] == "Failure"])
    return (failed / len(completed)) * 100.0


def calculate_time_to_restore(records: List[Dict]) -> float:
    """Calculate mean time to restore in minutes."""
    sorted_records = sorted(records, key=lambda r: r["created_at"])
    restore_times = []

    for i, record in enumerate(sorted_records):
        if record["conclusion"] == "Failure" and record["status"] == "completed":
            for j in range(i + 1, len(sorted_records)):
                if (sorted_records[j]["conclusion"] == "Success" and
                    sorted_records[j]["status"] == "completed"):
                    time_diff = sorted_records[j]["created_at"] - record["created_at"]
                    restore_times.append(time_diff.total_seconds() / 60.0)
                    break

    if not restore_times:
        return 0.0
    return sum(restore_times) / len(restore_times)


def format_duration(minutes: float) -> str:
    """Format duration to human-readable string."""
    if minutes < 60:
        return f"{minutes:.1f}min"
    elif minutes < 24 * 60:
        return f"{minutes/60:.1f}h"
    else:
        return f"{minutes/(24*60):.1f}d"


def main():
    parser = argparse.ArgumentParser(description="Calculate DORA metrics")
    parser.add_argument("input_file", help="Path to metrics-raw.md")
    args = parser.parse_args()

    records = parse_markdown_table(args.input_file)

    if len(records) == 0:
        print("No records found")
        return

    # Calculate all 4 metrics
    deployment_freq = calculate_deployment_frequency(records)
    lead_time = calculate_lead_time(records)
    failure_rate = calculate_change_failure_rate(records)
    restore_time = calculate_time_to_restore(records)

    # Output just the values
    print(f"Deployment Frequency: {deployment_freq:.2f} deployments/week")
    print(f"Lead Time for Changes: {format_duration(lead_time)}")
    print(f"Change Failure Rate: {failure_rate:.1f}%")
    print(f"Time to Restore: {format_duration(restore_time)}")


if __name__ == "__main__":
    main()
