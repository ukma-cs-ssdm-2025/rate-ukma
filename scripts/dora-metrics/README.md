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

## Weekly Updates (Append Mode)

```bash
# Same command every week - just change the date!
# Week 1: Creates new file (--append creates file if it doesn't exist)
./scripts/dora-metrics/generate_metrics.sh -w main-pipeline.yml -f 2024-01-01 --append -o metrics.md

# Week 2: Appends only new runs (skips duplicates)
./scripts/dora-metrics/generate_metrics.sh -w main-pipeline.yml -f 2024-11-01 --append -o metrics.md

# Week 3: Continue appending
./scripts/dora-metrics/generate_metrics.sh -w main-pipeline.yml -f 2024-11-15 --append -o metrics.md

# Calculate metrics from all data
python3 scripts/dora-metrics/calculate_dora_metrics.py metrics.md
```

**Note:** `--append` automatically creates the file on first run, so you can use the same command every week!

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
- `-a, --append` - Append to existing file (skips duplicates)

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

## CI Weekly Collection

For efficient weekly data collection in CI:

```yaml
# .github/workflows/weekly-dora.yml
name: DORA Metrics Collection
on:
  schedule:
    - cron: '0 0 * * 0'  # Every Sunday at midnight
  workflow_dispatch:

jobs:
  collect-metrics:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Fetch DORA metrics
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          # Same command every week - creates file on first run, appends thereafter
          ./scripts/dora-metrics/generate_metrics.sh \
            -w main-pipeline.yml \
            -f $(date -d '14 days ago' +%Y-%m-%d) \
            --append \
            -o dora-metrics.md

      - name: Calculate metrics
        run: |
          python3 scripts/dora-metrics/calculate_dora_metrics.py dora-metrics.md

      - name: Commit results
        run: |
          git config user.name "GitHub Actions"
          git config user.email "actions@github.com"
          git add dora-metrics.md
          git commit -m "chore: update DORA metrics data" || true
          git push
```

**Benefits:**
- Same command every week (no if/else needed)
- Fetches only ~14 days of data weekly (~10-50 runs)
- Saves API rate limits (5000 req/hour)
- Fast execution (< 30 seconds)
- Automatic duplicate detection
- Continuous historical data
- Creates file automatically on first run
