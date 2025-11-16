#!/usr/bin/env python3
"""Example of how to reuse DORA metrics functions."""

import sys
sys.path.insert(0, '/home/user/rate-ukma/scripts/dora-metrics')

from calculate_dora_metrics import (
    parse_table,
    deployment_frequency,
    lead_time,
    change_failure_rate,
    time_to_restore,
    format_duration,
)

# Parse data
runs = parse_table("metrics-raw.md")

# Calculate individual metrics
freq = deployment_frequency(runs)
lt = lead_time(runs)
cfr = change_failure_rate(runs)
ttr = time_to_restore(runs)

# Print results
print(f"Deployment Frequency: {freq:.2f}/week")
print(f"Lead Time: {format_duration(lt)}")
print(f"Change Failure Rate: {cfr:.1f}%")
print(f"Time to Restore: {format_duration(ttr)}")

# You can also filter runs before calculating
successful_runs = [r for r in runs if r["conclusion"] == "Success"]
print(f"\nTotal successful runs: {len(successful_runs)}")
