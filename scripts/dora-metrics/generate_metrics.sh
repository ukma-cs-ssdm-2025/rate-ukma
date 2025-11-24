#!/bin/bash

set -e          # Exit on any error
set -u          # Exit on undefined variable
set -o pipefail # Exit on pipe failure

# Default values
LIMIT=100
WORKFLOW_NAME="prod-pipeline.yml"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
METRICS_FILE="${SCRIPT_DIR}/results/metrics-raw.md"
CREATED_AFTER=""
CREATED_BEFORE=""
GH_BIN="${GH_BIN:-gh}"
APPEND_MODE=false

# Shared human-readable timestamp format with seconds, also used by jq via env.HUMAN_TIMESTAMP_FORMAT
export HUMAN_TIMESTAMP_FORMAT="%d %B %Y, %H:%M:%S %Z"

# Usage information
usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Generate DORA metrics raw data from GitHub Actions workflow runs.

OPTIONS:
    -w, --workflow WORKFLOW    Workflow file name (default: prod-pipeline.yml)
                               Options: main-pipeline.yml, prod-pipeline.yml, dev-pipeline.yml
    -l, --limit LIMIT          Number of workflow runs to fetch (default: 100)
    -f, --from DATE            Start date (YYYY-MM-DD format, optional)
    -t, --to DATE              End date (YYYY-MM-DD format, optional)
    -o, --output FILE          Output file path (default: scripts/dora-metrics/results/metrics-raw.md)
    -a, --append               Append to existing file (skip duplicates)
    -h, --help                 Show this help message

ENVIRONMENT:
    GITHUB_TOKEN               GitHub personal access token
    GH_BIN                     Path to gh binary (default: gh)

EXAMPLES:
    # Generate metrics for main pipeline (last 100 runs)
    $0 -w main-pipeline.yml

    # Generate metrics for prod pipeline with custom limit
    $0 -w prod-pipeline.yml -l 50

    # Generate metrics for specific date range
    $0 -w prod-pipeline.yml -f 2024-01-01 -t 2024-12-31

    # Generate metrics for dev pipeline with all options
    $0 -w dev-pipeline.yml -l 200 -f 2024-01-01 -o dev-metrics.md

EOF
    exit 1
    return 0
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -w|--workflow)
            WORKFLOW_NAME="$2"
            shift 2
            ;;
        -l|--limit)
            LIMIT="$2"
            shift 2
            ;;
        -f|--from)
            CREATED_AFTER="$2"
            shift 2
            ;;
        -t|--to)
            CREATED_BEFORE="$2"
            shift 2
            ;;
        -o|--output)
            METRICS_FILE="$2"
            shift 2
            ;;
        -a|--append)
            APPEND_MODE=true
            shift
            ;;
        -h|--help)
            usage
            ;;
        *)
            echo "Unknown option: $1"
            usage
            ;;
    esac
done

log() {
    timestamp=$(date +%Y-%m-%d\ %H:%M:%S)
    echo "[LOG:${timestamp}] $*" >&2
    return 0
}

ensure_git_up_to_date() {
    if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
        log "Not inside a git repository; cannot resolve commit messages locally"
        exit 1
    fi

    if ! git fetch --quiet; then
        log "Failed to fetch from remote; cannot verify repository state"
        exit 1
    fi

    local local_ref remote_ref
    local_ref=$(git rev-parse @)
    if ! remote_ref=$(git rev-parse "@{u}" 2>/dev/null); then
        log "Current branch has no upstream; cannot verify repository is up to date"
        exit 1
    fi

    if [[ "$local_ref" != "$remote_ref" ]]; then
        log "Local branch is not up to date with its upstream. Please pull the latest changes."
        exit 1
    fi

    return 0
}

fetch_all_runs() {
    log "Fetching workflow runs for '$WORKFLOW_NAME' (limit: $LIMIT)..."

    local gh_cmd=("$GH_BIN" "run" "list" "--workflow=$WORKFLOW_NAME" "--limit=$LIMIT")

    if [[ -n "$CREATED_AFTER" ]]; then
        gh_cmd+=("--created" ">=$CREATED_AFTER")
    fi

    if [[ -n "$CREATED_BEFORE" ]]; then
        gh_cmd+=("--created" "<=$CREATED_BEFORE")
    fi

    local runs
    runs=$("${gh_cmd[@]}" --json databaseId,status,conclusion,createdAt,updatedAt,headSha,event --jq '.[] | {
            id: .databaseId,
            sha: .headSha,
            shortSha: .headSha[0:7],
            status: .status,
            conclusion: .conclusion,
            createdAt: (.createdAt | fromdateiso8601 | strftime(env.HUMAN_TIMESTAMP_FORMAT)),
            event: .event,
            duration: (((.updatedAt | fromdate) - (.createdAt | fromdate)))
        }')


    local count
    count=$(echo "$runs" | jq -s 'length')
    log "Fetched $count workflow runs"
    echo "$runs"
    return 0
}

format_duration() {
    local duration_sec=$1
    local duration_min=$((duration_sec / 60))
    local duration_rem=$((duration_sec % 60))
    echo "${duration_min}m ${duration_rem}s"
    return 0
}

write_metadata() {
    local runs_json=$1
    local total_runs=$2
    local mode=$3

    local timestamps min_date max_date current_time
    timestamps=$(echo "$runs_json" | jq -r '.[].createdAt' | sort)
    min_date=$(echo "$timestamps" | head -1 | cut -dT -f1)
    max_date=$(echo "$timestamps" | tail -1 | cut -dT -f1)

    current_time=$(date -u +"$HUMAN_TIMESTAMP_FORMAT")

    if [[ "$mode" == "new" ]]; then
        cat > $METRICS_FILE << EOF
# DORA Metrics Data

- **Generated:** $current_time
- **Workflow:** $WORKFLOW_NAME
- **Runs fetched:** $total_runs
- **Time range:** $min_date to $max_date

**Collection parameters:**
- Limit: $LIMIT
- From date: ${CREATED_AFTER:-not set}
- To date: ${CREATED_BEFORE:-not set}

---

EOF
    else
        cat >> $METRICS_FILE << EOF

<!-- APPEND: $current_time - Added $total_runs runs from $min_date to $max_date -->
EOF
    fi
    return 0
}

get_existing_run_ids() {
    if [[ ! -f "$METRICS_FILE" ]]; then
        echo ""
        return
    fi

    # Extract run IDs from existing file (first column after '|')
    grep -E '^\| [0-9]+ \|' "$METRICS_FILE" 2>/dev/null | awk -F'|' '{print $2}' | tr -d ' ' || echo ""
    return 0
}

write_table_header() {
    log "Writing table header to $METRICS_FILE"
    cat >> $METRICS_FILE << 'EOF'
<!-- DORA_TABLE_START -->
| Run ID | Commit SHA | Status | Conclusion | Deployed? | Created At | Duration | Event | Commit Message |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
EOF
    return 0
}

get_commit_message() {
    local sha=$1
    git show -s --format=%s "$sha" 2>/dev/null | head -n1 | tr -d '\n\r' | tr '|' ',' || echo "N/A"
    return 0
}

process_run_data() {
    local line=$1

    local run_id sha short_sha status conclusion created_at duration_sec event duration deployed_label commit_message
    run_id=$(echo "$line" | jq -r '.id')
    sha=$(echo "$line" | jq -r '.sha')
    short_sha=$(echo "$line" | jq -r '.shortSha')
    status=$(echo "$line" | jq -r '.status')
    conclusion=$(echo "$line" | jq -r '.conclusion')
    created_at=$(echo "$line" | jq -r '.createdAt')
    duration_sec=$(echo "$line" | jq -r '.duration')
    event=$(echo "$line" | jq -r '.event')

    log "Processing run #$run_id: SHA=$short_sha, status=$status, conclusion=$conclusion"

    duration=$(format_duration "$duration_sec")
    deployed_label="No"
    if [[ "$status" == "completed" && "$conclusion" == "success" ]]; then
        deployed_label="Yes"
    fi
    commit_message=$(get_commit_message "$sha")

    log "Run #$run_id: SHA=$short_sha, status=$status, conclusion=$conclusion, deployed=$deployed_label, duration=$duration, event=$event"

    echo "| $run_id | $short_sha | $status | $conclusion | $deployed_label | $created_at | $duration | $event | $commit_message |"
    return 0
}

build_metrics_report() {
    log "Generation started (append mode: $APPEND_MODE)"

    mkdir -p "$(dirname "$METRICS_FILE")"

    log "Fetching all runs data"
    local runs_json total_runs
    runs_json=$(fetch_all_runs | jq -s '.')
    total_runs=$(echo "$runs_json" | jq 'length')
    log "Total runs fetched: $total_runs"

    if [[ $total_runs -eq 0 ]]; then
        log "No workflow runs found for the specified criteria"
        if [[ "$APPEND_MODE" == "false" ]]; then
            write_metadata "$runs_json" 0 "new"
            echo "No workflow runs found." >> $METRICS_FILE
        fi
        return
    fi

    if [[ "$APPEND_MODE" == "true" ]]; then
        if [[ ! -f "$METRICS_FILE" ]]; then
            log "File doesn't exist, creating new file (first run)"
            APPEND_MODE=false
        else
            log "Filtering duplicates..."
            local existing_ids filtered_json
            existing_ids=$(get_existing_run_ids)

            filtered_json=$(echo "$runs_json" | jq -c --arg existing_ids "$existing_ids" '
                [.[] | select(.id as $id | ($existing_ids | split("\n") | index($id | tostring) | not))]
            ')

            runs_json=$filtered_json
            total_runs=$(echo "$runs_json" | jq 'length')
            log "After filtering duplicates: $total_runs new runs"

            if [[ $total_runs -eq 0 ]]; then
                log "No new runs to add (all duplicates)"
                return
            fi
        fi
    fi

    if [[ "$APPEND_MODE" == "true" ]]; then
        write_metadata "$runs_json" "$total_runs" "append"
    else
        write_metadata "$runs_json" "$total_runs" "new"
    fi
    write_table_header

    log "Processing $total_runs runs"
    echo "$runs_json" | jq -c '.[]' | while read -r line; do
        process_run_data "$line" >> $METRICS_FILE
    done

    echo "<!-- DORA_TABLE_END -->" >> "$METRICS_FILE"

    log "Metrics report generated successfully: $METRICS_FILE"
    log "Total runs processed: $total_runs"
    return 0
}


log "Job: generate metrics report for '$WORKFLOW_NAME'"
log "Parameters: limit=$LIMIT, from=$CREATED_AFTER, to=$CREATED_BEFORE, output=$METRICS_FILE, append=$APPEND_MODE"

# Only remove file if not in append mode
if [[ "$APPEND_MODE" == "false" ]]; then
    rm -f $METRICS_FILE
fi

ensure_git_up_to_date
build_metrics_report

log "Job: done"
