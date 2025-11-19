#!/usr/bin/env python3
"""Generate DORA metrics report from workflow run data."""

import argparse
import os
import sys
from pathlib import Path

from dora_md_generator import DORAMetrics
from parse_dora_metrics import parse_table


def main():
    args = parse_arguments()

    try:
        runs = parse_table(args.metrics_file)

        metrics = DORAMetrics(runs)
        report = metrics.generate_report()

        output_path = Path(args.output).resolve()
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(report, encoding="utf-8")

        # metrics
        freq = metrics.deployment_frequency()
        lt = metrics.lead_time()
        cfr = metrics.change_failure_rate()
        ttr = metrics.time_to_restore()

        # additional statistics
        success_count = len(metrics.successful_runs)
        failed_count = len(metrics.failed_runs)
        success_rate = metrics.get_success_rate()
        overall_performance = metrics.get_overall_performance()

        # classifications
        freq_class = metrics.get_deployment_frequency_class()
        lt_class = metrics.get_lead_time_class()
        cfr_class = metrics.get_change_failure_rate_class()
        ttr_class = metrics.get_time_to_restore_class()

        print(f"Report generated: {output_path.name}")
        print(f"- {len(metrics.weekly_runs)} runs analyzed (past week)")
        print(f"- {success_count} successful deployments")
        print(f"- {freq:.2f} deployments/week ({freq_class})")
        print(f"- Overall DORA Performance: {overall_performance}")

        # Output metrics to GITHUB_OUTPUT if in CI environment
        github_output = os.getenv("GITHUB_OUTPUT")
        if github_output and args.gh:
            with open(github_output, "a") as f:
                # Core metrics
                f.write(f"deployment_frequency={freq:.2f}\n")
                f.write(f"lead_time={lt:.2f}\n")
                f.write(f"change_failure_rate={cfr:.2f}\n")
                f.write(f"time_to_restore={ttr:.2f}\n")

                # Run statistics
                f.write(f"total_runs={len(metrics.weekly_runs)}\n")
                f.write(f"successful_runs={success_count}\n")
                f.write(f"failed_runs={failed_count}\n")
                f.write(f"success_rate={success_rate:.2f}\n")

                # Classifications
                f.write(f"deployment_frequency_class={freq_class}\n")
                f.write(f"lead_time_class={lt_class}\n")
                f.write(f"change_failure_rate_class={cfr_class}\n")
                f.write(f"time_to_restore_class={ttr_class}\n")
                f.write(f"overall_performance={overall_performance}\n")

    except FileNotFoundError:
        print(f"Metrics file not found: {args.metrics_file}")
        sys.exit(1)
    except ValueError as e:
        print(f"Invalid data format: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"✗ Unexpected error: {e}")
        sys.exit(1)


def parse_arguments():
    parser = argparse.ArgumentParser(
        description="Generate DORA metrics report from workflow data"
    )

    # Support both positional and flag-based arguments for backward compatibility
    parser.add_argument(
        "metrics_file_positional",
        nargs="?",
        type=str,
        help="Path to the metrics-raw.md file (positional)",
    )
    parser.add_argument(
        "output_positional",
        nargs="?",
        type=str,
        help="Path to write the generated report (positional)",
    )
    parser.add_argument(
        "--metrics-file", type=str, help="Path to the metrics-raw.md file"
    )
    parser.add_argument("--output", type=str, help="Path to write the generated report")
    parser.add_argument(
        "--gh",
        action="store_true",
        help="Redirect the output to the GitHub output",
        default=False,
    )
    args = parser.parse_args()

    # Resolve which arguments to use (positional takes precedence)
    args.metrics_file = (
        args.metrics_file_positional or args.metrics_file or "docs/ci-cd/metrics-raw.md"
    )
    args.output = args.output_positional or args.output or "docs/ci-cd/dora-report.md"

    return args


if __name__ == "__main__":
    main()
