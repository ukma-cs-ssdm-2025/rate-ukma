# DORA Metrics Scripts

Calculate DORA (DevOps Research and Assessment) metrics for your CI/CD pipelines.

## What are DORA Metrics?

| Metric | What it shows | What pain it reflects |
| --- | --- | --- |
| **Deployment Frequency** | How often you deliver | Slow delivery = user frustration, gap between shipped code and delivered value |
| **Lead Time for Changes** | Time from code to the end user | Long cycles = slow learning, loss of focus |
| **Change Failure Rate** | How often releases break things | Loss of trust in releases, reduced stability |
| **Time to Restore** | How quickly the team reacts to failure | Panic, blame-hunting, late-night firefighting |

## Prerequisites

- GitHub CLI (`gh`) installed and authenticated
- Python 3.7+
- `jq` command-line JSON processor

## Quick Start

### 1. Install GitHub CLI

```bash
# Ubuntu/Debian
curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
sudo apt update && sudo apt install gh

# macOS
brew install gh
```

### 2. Authenticate with GitHub

Option A - Interactive login:
```bash
gh auth login
```

Option B - Using GitHub Token:
```bash
export GITHUB_TOKEN=your_github_token_here
# or
export GH_TOKEN=your_github_token_here
```

### 3. Generate metrics for a pipeline

```bash
# For main pipeline
./scripts/dora-metrics/generate_metrics.sh -w main-pipeline.yml -o metrics-raw.md

# For prod pipeline
./scripts/dora-metrics/generate_metrics.sh -w prod-pipeline.yml -o prod-metrics-raw.md

# For dev pipeline
./scripts/dora-metrics/generate_metrics.sh -w dev-pipeline.yml -o dev-metrics-raw.md
```

### 4. Calculate DORA metrics

```bash
python3 ./scripts/dora-metrics/calculate_dora_metrics.py metrics-raw.md
```

Output:
```
Deployment Frequency: 12.50 deployments/week
Lead Time for Changes: 15.0min
Change Failure Rate: 15.8%
Time to Restore: 2.0h
```

## Usage

### generate_metrics.sh

Fetches workflow run data from GitHub Actions.

```bash
./scripts/dora-metrics/generate_metrics.sh [OPTIONS]
```

**Options:**
- `-w, --workflow WORKFLOW` - Workflow file name (default: main-pipeline.yml)
- `-l, --limit LIMIT` - Number of runs to fetch (default: 100)
- `-f, --from DATE` - Start date YYYY-MM-DD (optional)
- `-t, --to DATE` - End date YYYY-MM-DD (optional)
- `-o, --output FILE` - Output file (default: metrics-raw.md)
- `-h, --help` - Show help

**Examples:**

```bash
# Last 100 runs from main pipeline
./scripts/dora-metrics/generate_metrics.sh -w main-pipeline.yml

# Last 50 runs from prod pipeline
./scripts/dora-metrics/generate_metrics.sh -w prod-pipeline.yml -l 50

# Specific date range
./scripts/dora-metrics/generate_metrics.sh -w main-pipeline.yml -f 2024-01-01 -t 2024-12-31

# All options
./scripts/dora-metrics/generate_metrics.sh -w dev-pipeline.yml -l 200 -f 2024-01-01 -o dev-metrics.md
```

### calculate_dora_metrics.py

Calculates the 4 DORA metrics from raw data.

```bash
python3 ./scripts/dora-metrics/calculate_dora_metrics.py <input_file>
```

**Example:**
```bash
python3 ./scripts/dora-metrics/calculate_dora_metrics.py metrics-raw.md
```

## Complete Examples

### Main Pipeline
```bash
./scripts/dora-metrics/generate_metrics.sh -w main-pipeline.yml -o main-metrics.md
python3 ./scripts/dora-metrics/calculate_dora_metrics.py main-metrics.md
```

### Production Pipeline
```bash
./scripts/dora-metrics/generate_metrics.sh -w prod-pipeline.yml -o prod-metrics.md
python3 ./scripts/dora-metrics/calculate_dora_metrics.py prod-metrics.md
```

### Dev Pipeline
```bash
./scripts/dora-metrics/generate_metrics.sh -w dev-pipeline.yml -o dev-metrics.md
python3 ./scripts/dora-metrics/calculate_dora_metrics.py dev-metrics.md
```

### Specific Time Period
```bash
./scripts/dora-metrics/generate_metrics.sh -w main-pipeline.yml -f 2024-10-01 -t 2024-12-31 -l 200 -o q4-metrics.md
python3 ./scripts/dora-metrics/calculate_dora_metrics.py q4-metrics.md
```

## Authentication

The `gh` CLI needs authentication to access your repository.

### Method 1: Interactive Login
```bash
gh auth login
```

### Method 2: GitHub Token
```bash
# Set environment variable
export GITHUB_TOKEN=ghp_your_token_here

# Or set GH_TOKEN
export GH_TOKEN=ghp_your_token_here

# Run the script
./scripts/dora-metrics/generate_metrics.sh -w main-pipeline.yml
```

### Method 3: Custom gh binary path
```bash
export GH_BIN=/path/to/gh
./scripts/dora-metrics/generate_metrics.sh -w main-pipeline.yml
```

## Troubleshooting

### "gh: command not found"
Install GitHub CLI (see Quick Start section above).

### "To get started with GitHub CLI, please run: gh auth login"
You need to authenticate:
```bash
gh auth login
# or
export GITHUB_TOKEN=your_token
```

### "No workflow runs found"
Check:
- Workflow name is correct (`main-pipeline.yml`, `prod-pipeline.yml`, or `dev-pipeline.yml`)
- Date range has runs
- You have repository access

### "jq: command not found"
```bash
# Ubuntu/Debian
sudo apt install jq

# macOS
brew install jq
```
