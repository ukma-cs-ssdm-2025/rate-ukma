import re
from datetime import datetime, timezone
from typing import TypedDict

TABLE_COLUMNS_NUMBER = 10
TABLE_MARKER_START = "<!-- DORA_TABLE_START -->"
TABLE_MARKER_END = "<!-- DORA_TABLE_END -->"
HEADER_RUN_ID = "Run ID"
HEADER_CONCLUSION = "Conclusion"

STATUS_COMPLETED = "completed"
CONCLUSION_SUCCESS = "success"
CONCLUSION_FAILURE = "failure"


class WorkflowRun(TypedDict):
    run_id: str
    commit_sha: str
    status: str
    conclusion: str
    created_at: datetime
    updated_at: datetime
    duration_minutes: float
    event: str
    deployed: str
    commit_message: str


def parse_iso_timestamp(timestamp_str: str) -> datetime:
    timestamp_str = timestamp_str.strip()
    try:
        return datetime.fromisoformat(timestamp_str.replace("Z", "+00:00"))
    except ValueError:
        return datetime.strptime(timestamp_str, "%Y-%m-%dT%H:%M:%SZ").replace(
            tzinfo=timezone.utc
        )


def parse_duration(time_str: str) -> float:
    minutes = 0.0
    seconds = 0.0

    if m := re.search(r"(\d+)m", time_str):
        minutes = float(m.group(1))
    if s := re.search(r"(\d+)s", time_str):
        seconds = float(s.group(1))

    return minutes + (seconds / 60.0)


def _find_header_index(block_lines: list[str]) -> int:
    header_idx = next(
        (
            i
            for i, line in enumerate(block_lines)
            if HEADER_RUN_ID in line and HEADER_CONCLUSION in line
        ),
        None,
    )
    if header_idx is None:
        raise ValueError("Table header not found")

    if header_idx + 1 >= len(block_lines) or "---" not in block_lines[header_idx + 1]:
        raise ValueError("Table separator row not found after header")

    return header_idx


def _parse_row(parts: list[str], file_path: str, raw_line: str) -> WorkflowRun:
    expected_parts = TABLE_COLUMNS_NUMBER + 2  # leading + trailing empty fields
    if len(parts) != expected_parts:
        raise ValueError(
            f"Malformed table row in {file_path!r}: {raw_line.strip()} "
            f"(expected {TABLE_COLUMNS_NUMBER} columns, got {len(parts) - 2})"
        )

    return {
        "run_id": parts[1],
        "commit_sha": parts[2],
        "status": parts[3],
        "conclusion": parts[4],
        "deployed": parts[5],
        "created_at": parse_iso_timestamp(parts[6]),
        "updated_at": parse_iso_timestamp(parts[7]),
        "duration_minutes": parse_duration(parts[8]),
        "event": parts[9],
        "commit_message": parts[10],
    }


def _parse_block(block_lines: list[str], file_path: str) -> list[WorkflowRun]:
    header_idx = _find_header_index(block_lines)

    runs_block: list[WorkflowRun] = []
    for line in block_lines[header_idx + 2 :]:
        stripped = line.strip()
        if not stripped:
            continue

        if not line.startswith("|"):
            raise ValueError(
                f"Unexpected non-table line inside DORA table in {file_path!r}: "
                f"{stripped}"
            )

        parts = [p.strip() for p in line.split("|")]
        runs_block.append(_parse_row(parts, file_path, line))

    if not runs_block:
        raise ValueError("No workflow runs found in table")

    return runs_block


def _extract_table_blocks(lines: list[str]) -> list[list[str]]:
    if not any(line.strip() == TABLE_MARKER_START for line in lines):
        raise ValueError("No DORA table block found in metrics file")

    tables: list[list[str]] = []
    current_block: list[str] = []
    inside = False

    for line in lines:
        stripped = line.strip()
        if stripped == TABLE_MARKER_START:
            if inside:
                raise ValueError("Nested DORA_TABLE_START markers are not supported")
            inside = True
            current_block = []
            continue
        if stripped == TABLE_MARKER_END:
            if not inside:
                raise ValueError("DORA_TABLE_END without matching start")
            tables.append(current_block)
            inside = False
            current_block = []
            continue

        if inside:
            current_block.append(line)

    if inside:
        raise ValueError("Unclosed DORA_TABLE_START marker in metrics file")

    if not tables:
        raise ValueError("No table content found between DORA_TABLE markers")

    return tables


def parse_table(file_path: str) -> list[WorkflowRun]:
    with open(file_path, "r") as f:
        lines = f.readlines()

    tables = _extract_table_blocks(lines)

    runs: list[WorkflowRun] = []
    for block in tables:
        runs.extend(_parse_block(block, file_path))
    return runs


def deployment_frequency(runs: list[WorkflowRun]) -> float:
    successful = [
        r
        for r in runs
        if r["status"] == STATUS_COMPLETED
        and r["conclusion"].lower() == CONCLUSION_SUCCESS
    ]

    if len(runs) < 2:
        return len(successful)

    timestamps = [r["created_at"] for r in runs]
    days = max(
        (max(timestamps) - min(timestamps)).total_seconds() / 86400.0,
        1.0,
    )
    return len(successful) / (days / 7.0)


def lead_time(runs: list[WorkflowRun]) -> float:
    successful = [
        r
        for r in runs
        if r["status"] == STATUS_COMPLETED
        and r["conclusion"].lower() == CONCLUSION_SUCCESS
    ]
    return (
        sum(r["duration_minutes"] for r in successful) / len(successful)
        if successful
        else 0.0
    )


def change_failure_rate(runs: list[WorkflowRun]) -> float:
    completed = [
        r
        for r in runs
        if r["status"] == STATUS_COMPLETED
        and r["conclusion"].lower() in [CONCLUSION_SUCCESS, CONCLUSION_FAILURE]
    ]
    if not completed:
        return 0.0
    failed = sum(1 for r in completed if r["conclusion"].lower() == CONCLUSION_FAILURE)
    return (failed / len(completed)) * 100.0


def time_to_restore(runs: list[WorkflowRun]) -> float:
    sorted_runs = sorted(runs, key=lambda r: r["created_at"])
    restore_times: list[float] = []

    for i, run in enumerate(sorted_runs):
        if (
            run["status"] == STATUS_COMPLETED
            and run["conclusion"].lower() == CONCLUSION_FAILURE
        ):
            for next_run in sorted_runs[i + 1 :]:
                if (
                    next_run["status"] == STATUS_COMPLETED
                    and next_run["conclusion"].lower() == CONCLUSION_SUCCESS
                ):
                    restore_times.append(
                        (next_run["created_at"] - run["created_at"]).total_seconds()
                        / 60.0
                    )
                    break

    return sum(restore_times) / len(restore_times) if restore_times else 0.0


def format_duration(minutes: float) -> str:
    if minutes < 60.0:
        total_seconds = int(round(minutes * 60.0))
        whole_minutes = total_seconds // 60
        seconds = total_seconds % 60
        return f"{whole_minutes}m {seconds}s"

    if minutes < 1440.0:
        total_minutes = int(round(minutes))
        hours = total_minutes // 60
        rem_minutes = total_minutes % 60
        return f"{hours}h {rem_minutes}m"

    total_minutes = int(round(minutes))
    days = total_minutes // 1440
    rem_minutes = total_minutes % 1440
    hours = rem_minutes // 60
    return f"{days}d {hours}h"
