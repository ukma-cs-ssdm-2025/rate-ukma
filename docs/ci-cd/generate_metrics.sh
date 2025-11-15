#!/bin/bash

# set -e
# set -u
# set -o pipefail

LIMIT=20
WORKFLOW_NAME="main-pipeline.yml"
METRICS_FILE="metrics-raw.md"
COMMIT_CACHE_FILE="/tmp/commit_cache.txt"


log() {
    timestamp=$(date +%Y-%m-%d\ %H:%M:%S)
    echo "[LOG:${timestamp}] $*" >&2
}

fetch_all_runs() {
    log "Fetching workflow runs for '$WORKFLOW_NAME' (limit: $LIMIT)..."
    local runs=$(gh run list \
        --workflow=$WORKFLOW_NAME \
        --limit=$LIMIT \
        --json databaseId,status,conclusion,createdAt,updatedAt,headSha \
        --jq '.[] | {
            id: .databaseId,
            sha: .headSha,
            shortSha: .headSha[0:7],
            status: .status,
            conclusion: .conclusion,
            duration: (((.updatedAt | fromdate) - (.createdAt | fromdate)))
        }')
    
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
    echo "$unique_shas" | while read -r sha; do
        ((current++))
        log "Fetching commit message for SHA $sha ($current/$sha_count)"
        local msg=$(gh api repos/:owner/:repo/commits/$sha --jq '.commit.message' 2>/dev/null | head -n1 | tr -d '\n\r' | tr '|' ',' || echo "N/A")
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
        success) echo "Yes" ;;
        failure) echo "No" ;;
        cancelled) echo "Cancelled" ;;
        *) echo "Pending" ;;
    esac
}

write_table_header() {
    log "Writing table header to $METRICS_FILE"
    echo "| Run # | Commit SHA | Status | Start → End (min) | Deployed? | Commit | Notes |" > $METRICS_FILE
    echo "| --- | --- | --- | --- | --- | --- | --- |" >> $METRICS_FILE
}

get_commit_message() {
    local sha=$1
    grep "^${sha}|" $COMMIT_CACHE_FILE 2>/dev/null | cut -d'|' -f2- || echo "N/A"
}

process_run_data() {
    local line=$1
    local count=$2
    
    local sha=$(echo "$line" | jq -r '.sha')
    local short_sha=$(echo "$line" | jq -r '.shortSha')
    local status=$(echo "$line" | jq -r '.status')
    local conclusion=$(echo "$line" | jq -r '.conclusion')
    local duration_sec=$(echo "$line" | jq -r '.duration')
    
    log "Processing run #$count: SHA=$short_sha, status=$status, conclusion=$conclusion"
    
    local commit_msg=$(get_commit_message "$sha")
    local duration=$(format_duration "$duration_sec")
    local status_label=$(get_status_label "$conclusion")
    
    log "Run #$count: duration=$duration, commit_msg=${commit_msg:0:50}..."
    
    echo "| $count | $short_sha | $status | $duration | $status_label | $commit_msg |  |"
}

build_metrics_report() {
    log "Generation started"
    
    write_table_header
    
    log "Fetching all runs data"

    local runs_json=$(fetch_all_runs | jq -s '.')
    local total_runs=$(echo "$runs_json" | jq 'length')
    log "Total runs to process: $total_runs"
    
    fetch_commit_messages_batch "$runs_json" > $COMMIT_CACHE_FILE
    log "Commit cache file created: $COMMIT_CACHE_FILE"
    
    log "Processing runs in batches"
    local count=1
    echo "$runs_json" | jq -c '.[]' | while read -r line; do
        process_run_data "$line" "$count" >> $METRICS_FILE
        ((count++))
    done
    
    log "Cleaning up cache file"
    rm -f $COMMIT_CACHE_FILE
    
    log "Metrics report generated successfully: $METRICS_FILE"
    log "Total runs processed: $total_runs"
}


log "Job: generate metrics report for '$WORKFLOW_NAME' (limit: $LIMIT)"

rm -f $METRICS_FILE
build_metrics_report

log "Job: done"