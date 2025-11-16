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
REPO="${REPO:-}"

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
    -r, --repo REPO            Repository (owner/name, uses git remote if not set)
    -h, --help                 Show this help message

ENVIRONMENT:
    GITHUB_TOKEN               GitHub personal access token
    REPO                       Repository (owner/name)
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
        -r|--repo)
            REPO="$2"
            shift 2
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

    # Build gh command with optional date filters
    local gh_cmd="$GH_BIN run list --workflow=$WORKFLOW_NAME --limit=$LIMIT"

    if [[ -n "$REPO" ]]; then
        gh_cmd="$gh_cmd --repo=$REPO"
    fi

    if [[ -n "$CREATED_AFTER" ]]; then
        gh_cmd="$gh_cmd --created >=$CREATED_AFTER"
    fi

    if [[ -n "$CREATED_BEFORE" ]]; then
        gh_cmd="$gh_cmd --created <=$CREATED_BEFORE"
    fi

    # Fetch runs with all necessary data for DORA metrics
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
    # extract all unique SHAs and fetch commit messages
    local unique_shas=$(echo "$runs_json" | jq -r '.[].sha' | sort -u)
    local sha_count=$(echo "$unique_shas" | wc -l)
    log "Found $sha_count unique commit SHAs"

    local current=0
    local api_repo_flag=""
    if [[ -n "$REPO" ]]; then
        api_repo_flag="--repo=$REPO"
    fi

    echo "$unique_shas" | while read -r sha; do
        ((current++))
        log "Fetching commit message for SHA $sha ($current/$sha_count)"
        local msg=$($GH_BIN api repos/:owner/:repo/commits/$sha $api_repo_flag --jq '.commit.message' 2>/dev/null | head -n1 | tr -d '\n\r' | tr '|' ',' || echo "N/A")
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

write_table_header() {
    log "Writing table header to $METRICS_FILE"
    cat > $METRICS_FILE << 'EOF'
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
    log "Generation started"

    write_table_header

    log "Fetching all runs data"

    local runs_json=$(fetch_all_runs | jq -s '.')
    local total_runs=$(echo "$runs_json" | jq 'length')
    log "Total runs to process: $total_runs"

    if [[ $total_runs -eq 0 ]]; then
        log "No workflow runs found for the specified criteria"
        echo ""
        echo "No workflow runs found." >> $METRICS_FILE
        return
    fi

    log "Processing runs"
    echo "$runs_json" | jq -c '.[]' | while read -r line; do
        process_run_data "$line" >> $METRICS_FILE
    done

    log "Metrics report generated successfully: $METRICS_FILE"
    log "Total runs processed: $total_runs"
}


log "Job: generate metrics report for '$WORKFLOW_NAME'"
log "Parameters: limit=$LIMIT, from=$CREATED_AFTER, to=$CREATED_BEFORE, output=$METRICS_FILE"

rm -f $METRICS_FILE
build_metrics_report

log "Job: done"
