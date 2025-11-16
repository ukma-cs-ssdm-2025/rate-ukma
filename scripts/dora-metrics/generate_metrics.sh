#!/bin/bash

set -e          # Exit on any error
set -u          # Exit on undefined variable
set -o pipefail # Exit on pipe failure

# Default values
LIMIT=100
WORKFLOW_NAME="main-pipeline.yml"
METRICS_FILE="metrics-raw.md"
COMMIT_CACHE_FILE="/tmp/commit_cache.txt"
CREATED_AFTER=""
CREATED_BEFORE=""
GH_BIN="${GH_BIN:-gh}"
APPEND_MODE=false

# Usage information
usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Generate DORA metrics raw data from GitHub Actions workflow runs.

OPTIONS:
    -w, --workflow WORKFLOW    Workflow file name (default: main-pipeline.yml)
                               Options: main-pipeline.yml, prod-pipeline.yml, dev-pipeline.yml
    -l, --limit LIMIT          Number of workflow runs to fetch (default: 100)
    -f, --from DATE            Start date (YYYY-MM-DD format, optional)
    -t, --to DATE              End date (YYYY-MM-DD format, optional)
    -o, --output FILE          Output file path (default: metrics-raw.md)
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
    $0 -w main-pipeline.yml -f 2024-01-01 -t 2024-12-31

    # Generate metrics for dev pipeline with all options
    $0 -w dev-pipeline.yml -l 200 -f 2024-01-01 -o dev-metrics.md

EOF
    exit 1
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
}

fetch_all_runs() {
    log "Fetching workflow runs for '$WORKFLOW_NAME' (limit: $LIMIT)..."

    local gh_cmd="$GH_BIN run list --workflow=$WORKFLOW_NAME --limit=$LIMIT"

    if [[ -n "$CREATED_AFTER" ]]; then
        gh_cmd="$gh_cmd --created >=$CREATED_AFTER"
    fi

    if [[ -n "$CREATED_BEFORE" ]]; then
        gh_cmd="$gh_cmd --created <=$CREATED_BEFORE"
    fi

    local runs=$(eval "$gh_cmd --json databaseId,status,conclusion,createdAt,updatedAt,headSha,event --jq '.[] | {
            id: .databaseId,
            sha: .headSha,
            shortSha: .headSha[0:7],
            status: .status,
            conclusion: .conclusion,
            createdAt: .createdAt,
            updatedAt: .updatedAt,
            event: .event,
            duration: (((.updatedAt | fromdate) - (.createdAt | fromdate)))
        }'")

    local count=$(echo "$runs" | jq -s 'length')
    log "Fetched $count workflow runs"
    echo "$runs"
}

fetch_commit_messages_batch() {
    local runs_json=$1

    log "Fetching commit messages..."
    local unique_shas=$(echo "$runs_json" | jq -r '.[].sha' | sort -u)
    local sha_count=$(echo "$unique_shas" | wc -l)
    log "Found $sha_count unique commit SHAs"

    local current=0
    echo "$unique_shas" | while read -r sha; do
        ((current++))
        log "Fetching commit message for SHA $sha ($current/$sha_count)"
        local msg=$($GH_BIN api repos/:owner/:repo/commits/$sha --jq '.commit.message' 2>/dev/null | head -n1 | tr -d '\n\r' | tr '|' ',' || echo "N/A")
        echo "${sha}|${msg}"
    done

    log "Commit messages fetched and cached"
}

format_duration() {
    local duration_sec=$1
    local duration_min=$((duration_sec / 60))
    local duration_rem=$((duration_sec % 60))
    echo "${duration_min}m ${duration_rem}s"
}

get_status_label() {
    local conclusion=$1
    case "$conclusion" in
        success) echo "Success" ;;
        failure) echo "Failure" ;;
        cancelled) echo "Cancelled" ;;
        skipped) echo "Skipped" ;;
        *) echo "Pending" ;;
    esac
}

write_metadata() {
    local runs_json=$1
    local total_runs=$2
    local mode=$3

    local timestamps=$(echo "$runs_json" | jq -r '.[].createdAt' | sort)
    local min_date=$(echo "$timestamps" | head -1 | cut -dT -f1)
    local max_date=$(echo "$timestamps" | tail -1 | cut -dT -f1)

    local current_time=$(date +"%Y-%m-%d %H:%M:%S")

    if [[ "$mode" == "new" ]]; then
        cat > $METRICS_FILE << EOF
# DORA Metrics Data

**Generated:** $current_time
**Workflow:** $WORKFLOW_NAME
**Runs fetched:** $total_runs
**Time range:** $min_date to $max_date

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
}

get_existing_run_ids() {
    if [[ ! -f "$METRICS_FILE" ]]; then
        echo ""
        return
    fi

    # Extract run IDs from existing file (first column after '|')
    grep -E '^\| [0-9]+ \|' "$METRICS_FILE" 2>/dev/null | awk -F'|' '{print $2}' | tr -d ' ' || echo ""
}

write_table_header() {
    log "Writing table header to $METRICS_FILE"
    cat >> $METRICS_FILE << 'EOF'
| Run ID | Commit SHA | Status | Conclusion | Created At | Updated At | Duration | Event | Commit Message |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
EOF
}

get_commit_message() {
    local sha=$1
    grep "^${sha}|" $COMMIT_CACHE_FILE 2>/dev/null | cut -d'|' -f2- || echo "N/A"
}

process_run_data() {
    local line=$1

    local run_id=$(echo "$line" | jq -r '.id')
    local sha=$(echo "$line" | jq -r '.sha')
    local short_sha=$(echo "$line" | jq -r '.shortSha')
    local status=$(echo "$line" | jq -r '.status')
    local conclusion=$(echo "$line" | jq -r '.conclusion')
    local created_at=$(echo "$line" | jq -r '.createdAt')
    local updated_at=$(echo "$line" | jq -r '.updatedAt')
    local duration_sec=$(echo "$line" | jq -r '.duration')
    local event=$(echo "$line" | jq -r '.event')

    log "Processing run #$run_id: SHA=$short_sha, status=$status, conclusion=$conclusion"

    local duration=$(format_duration "$duration_sec")
    local conclusion_label=$(get_status_label "$conclusion")

    log "Run #$run_id: SHA=$short_sha, duration=$duration, event=$event"

    echo "| $run_id | $short_sha | $status | $conclusion_label | $created_at | $updated_at | $duration | $event | - |"
}

build_metrics_report() {
    log "Generation started (append mode: $APPEND_MODE)"

    log "Fetching all runs data"
    local runs_json=$(fetch_all_runs | jq -s '.')
    local total_runs=$(echo "$runs_json" | jq 'length')
    log "Total runs fetched: $total_runs"

    if [[ $total_runs -eq 0 ]]; then
        log "No workflow runs found for the specified criteria"
        if [[ "$APPEND_MODE" == "false" ]]; then
            write_metadata "$runs_json" 0 "new"
            write_table_header
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
            local existing_ids=$(get_existing_run_ids)

            local filtered_json=$(echo "$runs_json" | jq -c --arg existing_ids "$existing_ids" '
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
        write_table_header
    fi

    log "Processing $total_runs runs"
    echo "$runs_json" | jq -c '.[]' | while read -r line; do
        process_run_data "$line" >> $METRICS_FILE
    done

    log "Metrics report generated successfully: $METRICS_FILE"
    log "Total runs processed: $total_runs"
}


log "Job: generate metrics report for '$WORKFLOW_NAME'"
log "Parameters: limit=$LIMIT, from=$CREATED_AFTER, to=$CREATED_BEFORE, output=$METRICS_FILE, append=$APPEND_MODE"

# Only remove file if not in append mode
if [[ "$APPEND_MODE" == "false" ]]; then
    rm -f $METRICS_FILE
fi

build_metrics_report

log "Job: done"
