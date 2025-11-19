#!/usr/bin/env python3
"""Generate DORA metrics report from workflow run data."""

import argparse
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

        output_path = Path(args.output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(report, encoding="utf-8")

        print(f"Report generated: {output_path}")
        print(f"- {len(metrics.weekly_runs)} runs analyzed (past week)")
        print(f"- {len(metrics.successful_runs)} successful deployments")
        print(f"- {metrics.deployment_frequency():.2f} deployments/week")

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
    parser.add_argument(
        "--metrics-file",
        type=str,
        default="docs/ci-cd/metrics-raw.md",
        help="Path to the metrics-raw.md file (default: docs/ci-cd/metrics-raw.md)",
    )
    parser.add_argument(
        "--output",
        type=str,
        default="docs/ci-cd/dora-report.md",
        help="Path to write the generated report (default: docs/ci-cd/dora-report.md)",
    )
    return parser.parse_args()


if __name__ == "__main__":
    main()
