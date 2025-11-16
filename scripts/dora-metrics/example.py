#!/usr/bin/env python3
"""Example of how to reuse DORA metrics functions."""

import sys
from pathlib import Path

from calculate_dora_metrics import (
    change_failure_rate,
    deployment_frequency,
    format_duration,
    lead_time,
    parse_table,
    time_to_restore,
)

script_dir = Path(__file__).parent
sys.path.insert(0, str(script_dir))
runs = parse_table(f"{script_dir}/results/metrics-raw.md")

freq = deployment_frequency(runs)
lt = lead_time(runs)
cfr = change_failure_rate(runs)
ttr = time_to_restore(runs)

print(f"Deployment Frequency: {freq:.2f}/week")
print(f"Lead Time: {format_duration(lt)}")
print(f"Change Failure Rate: {cfr:.1f}%")
print(f"Time to Restore: {format_duration(ttr)}")

successful_runs = [r for r in runs if r["conclusion"] == "Success"]
print(f"\nTotal successful runs: {len(successful_runs)}")
