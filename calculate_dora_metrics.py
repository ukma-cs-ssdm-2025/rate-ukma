#!/usr/bin/env python3
"""
Calculate DORA metrics from markdown table data.
"""

import re
from datetime import datetime
from typing import Dict, List, Tuple


def parse_time_duration(time_str: str) -> float:
    """Parse time string like '3m 48s' or '14m 13s' to minutes."""
    time_str = time_str.strip()
    minutes = 0.0
    seconds = 0.0

    # Extract minutes
    m_match = re.search(r"(\d+)m", time_str)
    if m_match:
        minutes = float(m_match.group(1))

    # Extract seconds
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
        if "Run #" in line and "Status" in line:
            header_line = i
            break

    if header_line is None:
        raise ValueError("Could not find table header")

    # Parse data rows (skip header and separator lines)
    for i in range(header_line + 2, len(lines)):
        line = lines[i].strip()
        if not line or line.startswith("| Run #"):
            continue

        # Split by pipe and clean up
        parts = [p.strip() for p in line.split("|")]
        if len(parts) < 5:
            continue

        # Extract fields
        run_id = parts[1].strip()
        commit_sha = parts[2].strip()
        status = parts[3].strip()
        time_duration = parts[4].strip()

        # Skip if missing essential data
        if not run_id or not status or not time_duration:
            continue

        # Parse time duration
        try:
            duration_minutes = parse_time_duration(time_duration)
        except ValueError:
            continue

        records.append(
            {
                "run_id": run_id,
                "commit_sha": commit_sha,
                "status": status,
                "duration_minutes": duration_minutes,
                "time_str": time_duration,
            }
        )

    return records


def calculate_deployment_frequency(records: List[Dict]) -> Tuple[float, str]:
    """Calculate deployment frequency: successful deployments per week."""
    successful_deployments = [r for r in records if r["status"] == "Yes"]
    total_successful = len(successful_deployments)

    # Estimate weeks: assume Run IDs are timestamps (Unix timestamp in milliseconds)
    # Get first and last run IDs to estimate time span
    if len(records) < 2:
        weeks = 1.0
    else:
        run_ids = [int(r["run_id"]) for r in records if r["run_id"].isdigit()]
        if len(run_ids) >= 2:
            # Run IDs appear to be Unix timestamps in milliseconds
            time_span_ms = max(run_ids) - min(run_ids)
            time_span_days = time_span_ms / (1000 * 60 * 60 * 24)
            weeks = max(time_span_days / 7.0, 1.0)  # At least 1 week
        else:
            weeks = 1.0

    deployments_per_week = total_successful / weeks

    # Categorize
    if deployments_per_week >= 1:
        category = "Elite"
    elif deployments_per_week >= 0.2:
        category = "High"
    elif deployments_per_week >= 0.033:
        category = "Medium"
    else:
        category = "Low"

    return deployments_per_week, category


def calculate_lead_time(records: List[Dict]) -> Tuple[float, str]:
    """Calculate lead time: mean time from merge to deploy (using duration as proxy)."""
    successful_deployments = [r for r in records if r["status"] == "Yes"]

    if not successful_deployments:
        return 0.0, "N/A"

    durations = [r["duration_minutes"] for r in successful_deployments]
    mean_duration = sum(durations) / len(durations)

    # Categorize (assuming duration represents lead time)
    if mean_duration <= 24 * 60:  # <= 1 day
        category = "Elite"
    elif mean_duration <= 7 * 24 * 60:  # <= 1 week
        category = "High"
    elif mean_duration <= 30 * 24 * 60:  # <= 1 month
        category = "Medium"
    else:
        category = "Low"

    return mean_duration, category


def calculate_change_failure_rate(records: List[Dict]) -> Tuple[float, str]:
    """Calculate change failure rate: failed / total deployments × 100%."""
    successful = len([r for r in records if r["status"] == "Yes"])
    failed = len([r for r in records if r["status"] == "No"])
    total = successful + failed

    if total == 0:
        return 0.0, "N/A"

    failure_rate = (failed / total) * 100.0

    # Categorize
    if failure_rate <= 5:
        category = "Elite"
    elif failure_rate <= 10:
        category = "High"
    elif failure_rate <= 15:
        category = "Medium"
    else:
        category = "Low"

    return failure_rate, category


def calculate_time_to_restore(records: List[Dict]) -> Tuple[float, str]:
    """Calculate time to restore: mean time to fix failed builds."""
    failed_deployments = [r for r in records if r["status"] == "No"]

    if not failed_deployments:
        return 0.0, "N/A"

    durations = [r["duration_minutes"] for r in failed_deployments]
    mean_duration = sum(durations) / len(durations)

    # Categorize
    if mean_duration <= 60:  # <= 1 hour
        category = "Elite"
    elif mean_duration <= 24 * 60:  # <= 1 day
        category = "High"
    elif mean_duration <= 7 * 24 * 60:  # <= 1 week
        category = "Medium"
    else:
        category = "Low"

    return mean_duration, category


def format_duration(minutes: float) -> str:
    """Format duration in minutes to human-readable string."""
    if minutes < 60:
        return f"{minutes:.2f} min"
    elif minutes < 24 * 60:
        hours = minutes / 60
        return f"{hours:.2f} hours"
    else:
        days = minutes / (24 * 60)
        return f"{days:.2f} days"


def generate_markdown_report(
    deployment_freq: float,
    freq_category: str,
    lead_time: float,
    lead_category: str,
    failure_rate: float,
    failure_category: str,
    restore_time: float,
    restore_category: str,
    records: List[Dict],
) -> str:
    """Generate markdown report with DORA metrics."""
    successful = len([r for r in records if r["status"] == "Yes"])
    failed = len([r for r in records if r["status"] == "No"])
    cancelled = len([r for r in records if r["status"] == "Cancelled"])
    pending = len([r for r in records if r["status"] == "Pending"])

    current_date = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    markdown = f"""# DORA Metrics Report

Generated on: {current_date}

## Metrics Summary

| Metric | Formula | Your Result | Category |
| --- | --- | --- | --- |
| Deployment Frequency | #successful deployments / week | {deployment_freq:.2f}/week | {freq_category} |
| Lead Time for Changes | mean(merge → deploy time) | {format_duration(lead_time)} | {lead_category} |
| Change Failure Rate | failed / total deployments × 100% | {failure_rate:.2f}% | {failure_category} |
| Time to Restore | mean(time to fix failed build) | {format_duration(restore_time)} | {restore_category} |

## Additional Statistics

- **Total records**: {len(records)}
- **Successful deployments**: {successful}
- **Failed deployments**: {failed}
- **Cancelled**: {cancelled}
- **Pending**: {pending}

## Category Reference

- **Elite**: Top performers
- **High**: Above average performers
- **Medium**: Average performers
- **Low**: Below average performers
"""
    return markdown


def main():
    file_path = "metrics-raw.md"

    print("Parsing markdown table...")
    records = parse_markdown_table(file_path)
    print(f"Found {len(records)} deployment records\n")

    # Calculate metrics
    deployment_freq, freq_category = calculate_deployment_frequency(records)
    lead_time, lead_category = calculate_lead_time(records)
    failure_rate, failure_category = calculate_change_failure_rate(records)
    restore_time, restore_category = calculate_time_to_restore(records)

    # Print results
    print("=" * 80)
    print("DORA METRICS RESULTS")
    print("=" * 80)
    print()

    print(f"{'Metric':<30} {'Formula':<40} {'Your Result':<20} {'Category':<10}")
    print("-" * 100)

    print(
        f"{'Deployment Frequency':<30} {'#successful deployments / week':<40} "
        f"{deployment_freq:.2f}/week{'':<15} {freq_category:<10}"
    )

    print(
        f"{'Lead Time for Changes':<30} {'mean(merge → deploy time)':<40} "
        f"{format_duration(lead_time):<20} {lead_category:<10}"
    )

    print(
        f"{'Change Failure Rate':<30} {'failed / total deployments × 100%':<40} "
        f"{failure_rate:.2f}%{'':<15} {failure_category:<10}"
    )

    print(
        f"{'Time to Restore':<30} {'mean(time to fix failed build)':<40} "
        f"{format_duration(restore_time):<20} {restore_category:<10}"
    )

    print()
    print("=" * 80)

    # Additional statistics
    successful = len([r for r in records if r["status"] == "Yes"])
    failed = len([r for r in records if r["status"] == "No"])
    cancelled = len([r for r in records if r["status"] == "Cancelled"])
    pending = len([r for r in records if r["status"] == "Pending"])

    print("\nAdditional Statistics:")
    print(f"  Total records: {len(records)}")
    print(f"  Successful deployments: {successful}")
    print(f"  Failed deployments: {failed}")
    print(f"  Cancelled: {cancelled}")
    print(f"  Pending: {pending}")

    # Generate and save markdown report
    markdown_report = generate_markdown_report(
        deployment_freq,
        freq_category,
        lead_time,
        lead_category,
        failure_rate,
        failure_category,
        restore_time,
        restore_category,
        records,
    )

    output_file = "dora-metrics-report.md"
    with open(output_file, "w", encoding="utf-8") as f:
        f.write(markdown_report)

    print(f"\n✓ Report saved to: {output_file}")


if __name__ == "__main__":
    main()
