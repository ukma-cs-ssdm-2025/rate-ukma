#!/usr/bin/env python3
"""Compares the students lists Rate UKMA scraped with the enrollments UKMA Data
parsed, by count per САЗ code. Prints counts and codes only, never a name or an
email from either side.

Usage: DATABASE_URL=... python3 -I tools/compare-rate.py <courses.jsonl> [--per-code]

`courses.jsonl` is Rate UKMA's scraper state (`src/backend/scraper/state`).
`--per-code` also prints one `code,year,rate,service,class` line per code.
"""

import csv
import io
import json
import os
import subprocess
import sys
from collections import Counter

QUERY = """
SELECT o.saz_code, o.academic_year, l.entry_count,
    (SELECT count(*) FROM enrollments e
        WHERE e.offering_id = o.id AND e.removed_at IS NULL) AS live,
    (SELECT p.status FROM run_pages p
        WHERE p.path = '/course/' || o.saz_code || '/students'
        ORDER BY p.id DESC LIMIT 1) AS page_status
FROM offerings o LEFT JOIN enrollment_lists l ON l.offering_id = o.id
"""

CLASSES = [
    ("equal", "Equal counts"),
    ("service_empty", "Service list is []"),
    ("service_more", "Service has more"),
    ("not_loaded", "No loaded list"),
    ("service_fewer", "Service has fewer"),
]

# Rate UKMA's own years; the newest one was still enrolling when it scraped.
SETTLED_YEARS = range(2018, 2026)


def read_rate(path):
    """Count of entries and first year per code; the entries are not kept."""
    rate = {}

    with open(path, encoding="utf-8") as lines:
        for line in lines:
            course = json.loads(line)
            year = course.get("academic_year") or ""
            rate[course["id"]] = (
                len(course.get("students") or []),
                int(year[:4]) if year[:4].isdigit() else None,
            )

    return rate


def read_service():
    url = os.environ.get("DATABASE_URL")

    if not url:
        sys.exit("DATABASE_URL is not set")

    out = subprocess.run(
        ["psql", url, "--csv", "-v", "ON_ERROR_STOP=1", "-c", QUERY],
        check=True,
        capture_output=True,
        text=True,
    ).stdout

    return {
        row["saz_code"]: row for row in csv.DictReader(io.StringIO(out))
    }


def classify(rate_count, row):
    if row is None:
        return "not_loaded", None, "no offering"

    if row["entry_count"] == "":
        return "not_loaded", None, row["page_status"] or "never fetched"

    service = int(row["live"])

    if service == rate_count:
        return "equal", service, None

    if service == 0:
        return "service_empty", service, None

    return ("service_more" if service > rate_count else "service_fewer"), service, None


def main():
    args = [arg for arg in sys.argv[1:] if not arg.startswith("--")]

    if len(args) != 1:
        sys.exit(__doc__)

    rate = read_rate(args[0])
    service = read_service()
    classes = {key: [] for key, _ in CLASSES}
    not_loaded = Counter()
    settled = Counter()
    lines = []

    for code, (rate_count, rate_year) in sorted(rate.items()):
        if rate_count == 0:
            continue

        row = service.get(code)
        kind, count, why = classify(rate_count, row)
        year = int(row["academic_year"]) if row else rate_year
        classes[kind].append(code)

        if why is not None:
            not_loaded[why] += 1

        if count and year in SETTLED_YEARS:
            settled["both"] += 1
            settled["equal"] += kind == "equal"

        lines.append(f"{code},{year},{rate_count},{'' if count is None else count},{kind}")

    total = sum(len(codes) for codes in classes.values())

    if "--per-code" in sys.argv:
        print("code,year,rate,service,class")
        print("\n".join(lines))
        print()

    print(f"Rate UKMA codes with a non-empty list: {total}")
    print()
    print("| Class | Codes | Share | First codes |")
    print("| --- | --- | --- | --- |")

    for key, label in CLASSES:
        codes = classes[key]
        detail = ""

        if key == "not_loaded" and not_loaded:
            detail = " (" + ", ".join(f"{n} {why}" for why, n in not_loaded.most_common()) + ")"

        print(
            f"| {label}{detail} | {len(codes)} | {100 * len(codes) / max(total, 1):.1f}% "
            f"| {', '.join(codes[:5])} |"
        )

    both = sum(
        1 for key in ("equal", "service_more", "service_fewer") for _ in classes[key]
    )
    print()
    print(
        f"Both non-empty: {len(classes['equal'])} of {both} equal "
        f"({100 * len(classes['equal']) / max(both, 1):.1f}%)"
    )
    print(
        f"Both non-empty, {SETTLED_YEARS.start}-{SETTLED_YEARS.start % 100 + 1:02d} to "
        f"{SETTLED_YEARS.stop - 1}-{SETTLED_YEARS.stop % 100:02d}: "
        f"{settled['equal']} of {settled['both']} equal "
        f"({100 * settled['equal'] / max(settled['both'], 1):.1f}%)"
    )


if __name__ == "__main__":
    main()
