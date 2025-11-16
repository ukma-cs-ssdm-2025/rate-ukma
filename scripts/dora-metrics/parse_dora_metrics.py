import re
from datetime import datetime, timezone
from typing import TypedDict

TABLE_COLUMNS_NUMBER = 10
TABLE_MARKER_START = "<!-- DORA_TABLE_START -->"
TABLE_MARKER_END = "<!-- DORA_TABLE_END -->"
HEADER_RUN_ID = "Run ID"
HEADER_CONCLUSION = "Conclusion"


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


def _has_table_markers(lines: list[str]) -> bool:
    return any(line.strip() == TABLE_MARKER_START for line in lines)


def _extract_table_blocks(lines: list[str]) -> list[list[str]]:
    if not _has_table_markers(lines):
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
