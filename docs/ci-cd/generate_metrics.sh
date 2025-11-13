#!/bin/bash

LIMIT=20
WORKFLOW_NAME="main-pipeline.yml"

fetch_metrics() {    
    local run_ids=$(gh run list --workflow=$WORKFLOW_NAME --limit=$LIMIT --json databaseId --jq '.[].databaseId')
    
    for run_id in $run_ids; do
        local run_data=$(gh run view $run_id --json databaseId,status,conclusion,createdAt,updatedAt,headSha --jq '((.updatedAt | fromdate) - (.createdAt | fromdate)) as $d | "\(.databaseId)|\(.headSha[0:7])|\(.headSha)|\(.status)|\(.conclusion)|\($d/60|floor)m \($d%60|floor)s"' | tr -d '"')
        
        local full_sha=$(echo "$run_data" | cut -d'|' -f3)
        local commit_msg=$(gh api repos/:owner/:repo/commits/$full_sha --jq '.commit.message' 2>/dev/null | head -n1 | tr -d '\n\r' | tr '|' ',' || echo "N/A")
        
        local base_data=$(echo "$run_data" | cut -d'|' -f1,2,4,5,6)
        echo "${base_data}|${commit_msg}"
    done
}

create_table() {
    echo "| Run # | Commit SHA | Status | Start → End (min) | Deployed? | Notes |" >> metrics-raw.md
    echo "| --- | --- | --- | --- | --- | --- |" >> metrics-raw.md
    
    fetch_metrics | while IFS='|' read -r run_id sha status conclusion duration commit_msg; do
        local status_label
        case "$conclusion" in
            success) status_label="Yes" ;;
            failure) status_label="No" ;;
            cancelled) status_label="Cancelled" ;;
            *) status_label="Pending" ;;
        esac
        
        echo "| $run_id | $sha | $status_label | $duration | $commit_msg |" >> metrics-raw.md
    done
}

main() {
    create_table
}

main
