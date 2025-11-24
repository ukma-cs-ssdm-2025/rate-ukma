# DORA Metrics

Calculate the 4 key DORA metrics for your CI/CD pipelines.

## What are DORA Metrics?

| Metric                    | What it shows                          | What pain it reflects                                                          |
| ------------------------- | -------------------------------------- | ------------------------------------------------------------------------------ |
| **Deployment Frequency**  | How often you deliver                  | Slow delivery = user frustration, gap between shipped code and delivered value |
| **Lead Time for Changes** | Time from code to the end user         | Long cycles = slow learning, loss of focus                                     |
| **Change Failure Rate**   | How often releases break things        | Loss of trust in releases, reduced stability                                   |
| **Time to Restore**       | How quickly the team reacts to failure | Panic, blame-hunting, late-night firefighting                                  |

## Prerequisites

- `gh` (GitHub CLI)
- `jq`
- Python 3.12+

## Authentication

```bash
# Method 1: Environment variable
export GITHUB_TOKEN=ghp_your_token_here

# Method 2: Interactive login
gh auth login
```

## Usage

```bash
# Fetch workflow data (to see all options run --help)
# From the project root, run:
./scripts/dora-metrics/generate_metrics.sh --workflow prod-pipeline.yml --limit 20

# TODO: TBD - report generation
```

## Example script

**TODO: remove this**

See `example.py` for how to import and use the calculation functions in your own scripts.

```bash
python scripts/dora-metrics/example.py
```

It would give you the following output:

```text
Deployment Frequency: 25.12/week
Lead Time: 12m 56s
Change Failure Rate: 25.4%
Time to Restore: 4h 39m

Total successful runs: 94
```
