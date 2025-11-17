from parse_dora_metrics import WorkflowRun

STATUS_COMPLETED = "completed"
CONCLUSION_SUCCESS = "success"
CONCLUSION_FAILURE = "failure"


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
