import json
from collections import Counter
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError

import structlog

logger = structlog.get_logger(__name__)

EXAMPLES_LIMIT = 30
VALUE_PREVIEW_LIMIT = 120


def _fmt(value) -> str:
    text = " ".join(str(value).split())
    if len(text) > VALUE_PREVIEW_LIMIT:
        text = text[:VALUE_PREVIEW_LIMIT] + "…"
    return text


def diff_sections(before: dict, after: dict) -> dict:
    result = {}
    for section in before.keys() | after.keys():
        before_records = before.get(section, {})
        after_records = after.get(section, {})

        added = sorted(after_records.keys() - before_records.keys())
        removed = sorted(before_records.keys() - after_records.keys())
        changed = {}
        for key in before_records.keys() & after_records.keys():
            before_fields = before_records[key]
            after_fields = after_records[key]
            field_changes = {
                field: {"before": before_fields.get(field), "after": after_fields.get(field)}
                for field in before_fields.keys() | after_fields.keys()
                if before_fields.get(field) != after_fields.get(field)
            }
            if field_changes:
                changed[key] = field_changes

        result[section] = {"added": added, "removed": removed, "changed": changed}
    return result


def render_report(diff: dict, full: bool) -> str:
    lines = [
        "# Catalog snapshot diff",
        "",
        "| Section | Added | Removed | Changed |",
        "|---|---|---|---|",
    ]
    for section, d in sorted(diff.items()):
        lines.append(
            f"| {section} | {len(d['added'])} | {len(d['removed'])} | {len(d['changed'])} |"
        )
    lines.append("")

    limit = None if full else EXAMPLES_LIMIT
    for section, d in sorted(diff.items()):
        if not (d["added"] or d["removed"] or d["changed"]):
            continue
        lines.append(f"## {section}")
        if d["changed"]:
            field_counts = Counter(field for fields in d["changed"].values() for field in fields)
            frequency = ", ".join(
                f"{field}: {count}" for field, count in field_counts.most_common()
            )
            lines.append(f"Changed fields: {frequency}")
            lines.append("")
        for kind in ("added", "removed"):
            keys = d[kind]
            if not keys:
                continue
            lines.append(f"### {kind} ({len(keys)})")
            lines.extend(f"- {_fmt(key)}" for key in keys[:limit])
            if limit and len(keys) > limit:
                lines.append(f"- … and {len(keys) - limit} more")
        if d["changed"]:
            lines.append(f"### changed ({len(d['changed'])})")
            for key, fields in sorted(d["changed"].items())[:limit]:
                lines.append(f"- {_fmt(key)}")
                for field, values in fields.items():
                    lines.append(f"  - {field}: {_fmt(values['before'])} → {_fmt(values['after'])}")
            if limit and len(d["changed"]) > limit:
                lines.append(f"- … and {len(d['changed']) - limit} more")
        lines.append("")
    return "\n".join(lines)


class Command(BaseCommand):
    help = "Diff two catalog snapshots (see snapshot_catalog) into a markdown report"

    def add_arguments(self, parser):
        parser.add_argument("before", type=str, help="Snapshot JSON taken before ingestion")
        parser.add_argument("after", type=str, help="Snapshot JSON taken after ingestion")
        parser.add_argument(
            "--out",
            type=str,
            default=None,
            help="Write capped report to file plus an uncapped <name>.full.md (default: stdout)",
        )
        parser.add_argument(
            "--full",
            action="store_true",
            help="Print all diff entries to stdout instead of capping examples",
        )

    def handle(self, *args, **options):
        before_path = Path(options["before"])
        after_path = Path(options["after"])
        for path in (before_path, after_path):
            if not path.exists():
                raise CommandError(f"Snapshot file not found: {path}")

        before = json.loads(before_path.read_text(encoding="utf-8"))
        after = json.loads(after_path.read_text(encoding="utf-8"))

        diff = diff_sections(before, after)

        if options["out"]:
            out_path = Path(options["out"])
            out_path.write_text(render_report(diff, full=False), encoding="utf-8")
            full_path = out_path.with_suffix(".full.md")
            full_path.write_text(render_report(diff, full=True), encoding="utf-8")
            logger.info("diff_report_saved", path=str(out_path), full_path=str(full_path))
        else:
            self.stdout.write(render_report(diff, full=options["full"]))
