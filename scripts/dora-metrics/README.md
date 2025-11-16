# DORA Metrics

Calculate the 4 key DORA metrics for your CI/CD pipelines.

## Quick Example

```bash
# 1. Set your GitHub token
export GITHUB_TOKEN=ghp_your_token_here

# 2. Fetch workflow data
./scripts/dora-metrics/generate_metrics.sh -w main-pipeline.yml -l 20

# 3. Calculate metrics
python3 scripts/dora-metrics/calculate_dora_metrics.py metrics-raw.md
```

Output:
```
Deployment Frequency: 12.50 deployments/week
Lead Time for Changes: 15.0min
Change Failure Rate: 15.8%
Time to Restore: 2.0h
```

## What are DORA Metrics?

| Metric | What it shows | What pain it reflects |
| --- | --- | --- |
| **Deployment Frequency** | How often you deliver | Slow delivery = user frustration, gap between shipped code and delivered value |
| **Lead Time for Changes** | Time from code to the end user | Long cycles = slow learning, loss of focus |
| **Change Failure Rate** | How often releases break things | Loss of trust in releases, reduced stability |
| **Time to Restore** | How quickly the team reacts to failure | Panic, blame-hunting, late-night firefighting |

## Prerequisites

- `gh` (GitHub CLI)
- `jq`
- Python 3.10+

## Authentication

```bash
# Method 1: Environment variable
export GITHUB_TOKEN=ghp_your_token_here

# Method 2: Interactive login
gh auth login
```

## Usage

### Fetch Data

```bash
./scripts/dora-metrics/generate_metrics.sh [OPTIONS]
```

Options:
- `-w, --workflow` - Workflow file (main-pipeline.yml, prod-pipeline.yml, dev-pipeline.yml)
- `-l, --limit` - Number of runs (default: 100)
- `-f, --from` - Start date (YYYY-MM-DD)
- `-t, --to` - End date (YYYY-MM-DD)
- `-o, --output` - Output file (default: metrics-raw.md)

Examples:
```bash
# Main pipeline, last 100 runs
./scripts/dora-metrics/generate_metrics.sh -w main-pipeline.yml

# Prod pipeline, last 50 runs
./scripts/dora-metrics/generate_metrics.sh -w prod-pipeline.yml -l 50

# Date range
./scripts/dora-metrics/generate_metrics.sh -w main-pipeline.yml -f 2024-01-01 -t 2024-12-31
```

### Calculate Metrics

```bash
python3 scripts/dora-metrics/calculate_dora_metrics.py <file>
```

Example:
```bash
python3 scripts/dora-metrics/calculate_dora_metrics.py metrics-raw.md
```

## Reusing Functions

The Python script exports functions you can import:

```python
from calculate_dora_metrics import parse_table, deployment_frequency, lead_time, change_failure_rate, time_to_restore

runs = parse_table("metrics-raw.md")
print(f"Frequency: {deployment_frequency(runs):.2f}/week")
print(f"Lead Time: {lead_time(runs):.1f}min")
print(f"Failure Rate: {change_failure_rate(runs):.1f}%")
print(f"Restore Time: {time_to_restore(runs):.1f}min")
```

## Complete Examples

### Main Pipeline
```bash
export GITHUB_TOKEN=your_token
./scripts/dora-metrics/generate_metrics.sh -w main-pipeline.yml -o main.md
python3 scripts/dora-metrics/calculate_dora_metrics.py main.md
```

### Production Pipeline
```bash
export GITHUB_TOKEN=your_token
./scripts/dora-metrics/generate_metrics.sh -w prod-pipeline.yml -o prod.md
python3 scripts/dora-metrics/calculate_dora_metrics.py prod.md
```

### Dev Pipeline
```bash
export GITHUB_TOKEN=your_token
./scripts/dora-metrics/generate_metrics.sh -w dev-pipeline.yml -o dev.md
python3 scripts/dora-metrics/calculate_dora_metrics.py dev.md
```
