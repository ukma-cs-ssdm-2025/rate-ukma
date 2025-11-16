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
# Fetch workflow data
./scripts/dora-metrics/generate_metrics.sh -w main-pipeline.yml -l 20

# Calculate metrics
python3 scripts/dora-metrics/calculate_dora_metrics.py scripts/dora-metrics/results/metrics-raw.md
```

For more options, run:
```bash
./scripts/dora-metrics/generate_metrics.sh --help
```

## Example script

**TODO: remove this**

See `example.py` for how to import and use the calculation functions in your own scripts.
