import csv
import unicodedata

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

import structlog

from rating_app.models import CourseInstructor, Instructor

logger = structlog.get_logger(__name__)


_REQUIRED_COLUMNS = ("displayName", "userPrincipalName", "userType")
_INTERNAL_DOMAIN_SUFFIX = "@ukma.edu.ua"
_EXTERNAL_MARKER = "#ext#"

_FORBIDDEN_DISPLAY_CHARS = frozenset("«»\"()[]@/&")
_SERVICE_WORDS = frozenset(
    {
        "team",
        "admin",
        "office",
        "info",
        "support",
        "service",
        "mailbox",
        "mailboxes",
        "lab",
        "club",
        "foundation",
        "power",
        "bi",
        "union",
        "ngo",
        "group",
        "community",
        "center",
        "centre",
        "committee",
        "program",
        "programme",
        "newsletter",
        "news",
        "media",
        "press",
        "pr",
        "hr",
        "it",
        "helpdesk",
        "finance",
        "accounting",
        "library",
        "archives",
        "backup",
        "account",
    }
)
_RESERVED_LOCAL_PARTS = frozenset(
    {
        "abuse",
        "abitteam",
        "admin",
        "info",
        "support",
        "office",
        "helpdesk",
        "hr",
        "it",
        "news",
        "press",
        "pr",
        "library",
        "welcome",
        "noreply",
        "mailer",
        "backup",
    }
)


def _is_internal(row: dict[str, str]) -> bool:
    upn = (row.get("userPrincipalName") or "").lower()
    user_type = (row.get("userType") or "").strip()
    if not upn.endswith(_INTERNAL_DOMAIN_SUFFIX):
        return False
    if _EXTERNAL_MARKER in upn:
        return False
    return user_type == "Member"


def _is_service_display(name: str) -> bool:
    """Return True when displayName looks like a shared mailbox / service account."""
    if not name or not name.strip():
        return True
    stripped = name.strip()
    if stripped == stripped.lower():
        return True
    if not any(ch.islower() for ch in stripped):
        return True
    if any(ch in _FORBIDDEN_DISPLAY_CHARS for ch in stripped):
        return True
    tokens = [t for t in _split_tokens(stripped) if t]
    if len(tokens) < 2:
        return True
    for token in tokens[:3]:
        if not _is_letter_token(token):
            return True
        if token.lower() in _SERVICE_WORDS:
            return True
    return False


def _is_service_upn_local(local: str) -> bool:
    local_lower = local.lower()
    if local_lower in _RESERVED_LOCAL_PARTS:
        return True
    if "_" in local_lower:
        return True
    return False


def _split_tokens(value: str) -> list[str]:
    out: list[str] = []
    current: list[str] = []
    for ch in value:
        if ch.isspace() or ch in {".", "-"}:
            if current:
                out.append("".join(current))
                current = []
        else:
            current.append(ch)
    if current:
        out.append("".join(current))
    return out


def _is_letter_token(token: str) -> bool:
    if not token:
        return False
    for ch in token:
        if ch in {"'", "ʼ", "’", "-"}:
            continue
        if not ch.isalpha():
            return False
    return True


def _is_cyrillic(ch: str) -> bool:
    if not ch:
        return False
    try:
        return "CYRILLIC" in unicodedata.name(ch)
    except ValueError:
        return False


def _parse_name(display_name: str) -> tuple[str, str, str]:
    """Return (first_name, patronymic, last_name).

    Ukrainian display names follow `Last First [Patronymic]`; Latin display names
    follow `First Last`. Detection is based on the first alphabetic character of
    the displayName.
    """
    tokens = [t for t in display_name.strip().split() if t]
    if not tokens:
        return "", "", ""

    first_letter = next((ch for ch in display_name if ch.isalpha()), "")
    if _is_cyrillic(first_letter):
        last_name = tokens[0]
        first_name = tokens[1] if len(tokens) > 1 else ""
        patronymic = tokens[2] if len(tokens) > 2 else ""
        return first_name, patronymic, last_name

    if len(tokens) == 1:
        return tokens[0], "", ""
    return tokens[0], "", " ".join(tokens[1:])


def _open_csv(path: str):
    # open() defers decoding until the first read, so we must probe a chunk to
    # actually trigger (and catch) a wrong-encoding UnicodeDecodeError here
    # rather than letting it escape later from the csv reader.
    for encoding in ("utf-8-sig", "utf-16"):
        handle = None
        try:
            handle = open(path, encoding=encoding, newline="")
            handle.read(512)
            handle.seek(0)
            return handle
        except UnicodeError:
            if handle is not None:
                handle.close()
            continue
    raise CommandError(f"Unable to decode CSV at {path} as utf-8-sig or utf-16")


class Command(BaseCommand):
    help = (
        "Ingest instructors from a Microsoft 365 user export CSV. Filters out "
        "guests and service accounts. Students share the @ukma.edu.ua domain and "
        "are intentionally kept (they cannot be told apart from teaching staff in "
        "the export); the ranked instructor list surfaces actually-rated teachers "
        "first, so students stay in the searchable tail."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "csv_path",
            type=str,
            help="Path to the M365 user export CSV (e.g. exportUsers_*.csv).",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Run the filter pipeline and report counts without writing.",
        )
        parser.add_argument(
            "--purge",
            action="store_true",
            help=(
                "Delete all existing Instructor rows (cascades to CourseInstructor) "
                "before ingest."
            ),
        )

    @transaction.atomic
    def handle(self, *args, **options):
        csv_path: str = options["csv_path"]
        dry_run: bool = options["dry_run"]
        purge: bool = options["purge"]

        rows = self._load_rows(csv_path)
        logger.info("instructors_csv_loaded", path=csv_path, row_count=len(rows))

        candidates, counters = self._filter_rows(rows)
        logger.info(
            "instructors_filtered",
            **counters,
            kept=len(candidates),
        )
        self.stdout.write(
            f"  Loaded: {len(rows)}\n"
            f"  Dropped non-internal: {counters['dropped_non_internal']}\n"
            f"  Dropped service display: {counters['dropped_service_display']}\n"
            f"  Dropped service UPN: {counters['dropped_service_upn']}\n"
            f"  Candidates: {len(candidates)}\n"
        )

        if purge:
            self._purge(dry_run)

        created, updated = self._upsert(candidates, dry_run)
        logger.info(
            "instructors_ingest_complete",
            created=created,
            updated=updated,
            dry_run=dry_run,
        )

        if dry_run:
            self.stdout.write(self.style.WARNING("Dry run — no changes made."))
            transaction.set_rollback(True)
        else:
            self.stdout.write(
                self.style.SUCCESS(f"Done. created={created} updated={updated}")
            )

    def _load_rows(self, path: str) -> list[dict[str, str]]:
        try:
            handle = _open_csv(path)
        except FileNotFoundError as exc:
            raise CommandError(f"CSV not found: {path}") from exc

        with handle as fh:
            reader = csv.DictReader(fh)
            if reader.fieldnames is None:
                raise CommandError("CSV has no header row")
            missing = [c for c in _REQUIRED_COLUMNS if c not in reader.fieldnames]
            if missing:
                raise CommandError(
                    f"CSV missing required columns: {', '.join(missing)}"
                )
            return list(reader)

    def _filter_rows(
        self,
        rows: list[dict[str, str]],
    ) -> tuple[list[dict[str, str]], dict[str, int]]:
        counters = {
            "dropped_non_internal": 0,
            "dropped_service_display": 0,
            "dropped_service_upn": 0,
        }
        kept: list[dict[str, str]] = []
        for row in rows:
            if not _is_internal(row):
                counters["dropped_non_internal"] += 1
                continue
            display_name = (row.get("displayName") or "").strip()
            if _is_service_display(display_name):
                counters["dropped_service_display"] += 1
                continue
            upn = (row.get("userPrincipalName") or "").lower()
            local_part = upn.split("@", 1)[0]
            if _is_service_upn_local(local_part):
                counters["dropped_service_upn"] += 1
                continue
            # Students share the @ukma.edu.ua domain and cannot be told apart
            # from teaching staff in the export, so they are intentionally kept;
            # the ranked instructor list surfaces actually-rated teachers first.
            kept.append(row)
        return kept, counters

    def _purge(self, dry_run: bool) -> None:
        ci_count = CourseInstructor.objects.count()
        instr_count = Instructor.objects.count()
        if not dry_run:
            CourseInstructor.objects.all().delete()
            Instructor.objects.all().delete()
        logger.info(
            "instructors_purged",
            course_instructor_rows=ci_count,
            instructor_rows=instr_count,
            dry_run=dry_run,
        )
        self.stdout.write(
            f"  Purge: {instr_count} instructors, {ci_count} course_instructors"
            f"{' (dry-run)' if dry_run else ''}"
        )

    def _upsert(
        self,
        candidates: list[dict[str, str]],
        dry_run: bool,
    ) -> tuple[int, int]:
        created = 0
        updated = 0
        for row in candidates:
            email = (row["userPrincipalName"] or "").lower()
            first_name, patronymic, last_name = _parse_name(row["displayName"])
            if not last_name and not first_name:
                continue
            if dry_run:
                exists = Instructor.objects.filter(email=email).exists()
                if exists:
                    updated += 1
                else:
                    created += 1
                continue
            _, was_created = Instructor.objects.update_or_create(
                email=email,
                defaults={
                    "first_name": first_name,
                    "last_name": last_name,
                    "patronymic": patronymic,
                },
            )
            if was_created:
                created += 1
                logger.debug("instructor_upserted", email=email, created=True)
            else:
                updated += 1
                logger.debug("instructor_upserted", email=email, created=False)
        return created, updated
