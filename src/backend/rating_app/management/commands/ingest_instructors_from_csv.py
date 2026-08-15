import csv
import unicodedata

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

import structlog

from rating_app.models import Instructor

logger = structlog.get_logger(__name__)


_REQUIRED_COLUMNS = ("displayName", "userPrincipalName", "userType")
_INTERNAL_DOMAIN_SUFFIX = "@ukma.edu.ua"
_EXTERNAL_MARKER = "#ext#"

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
    """Return True when displayName looks like a shared mailbox / service account.

    A personal name is positively recognised by structure: at least two
    whitespace-separated tokens, each made only of letters (plus apostrophes and
    hyphens), with normal capitalisation and no digits. Anything else (acronyms,
    all-lowercase aliases, room/lab names with numbers, quoted org titles) is
    treated as a service account. `_SERVICE_WORDS` is the residual denylist for
    the hard case structure cannot catch: title-cased English service mailboxes
    (e.g. "Backup Account") that look exactly like a "First Last" name.
    """
    if not name or not name.strip():
        return True
    stripped = name.strip()
    if any(ch.isdigit() for ch in stripped):
        return True
    if stripped == stripped.lower():
        return True
    if not any(ch.islower() for ch in stripped):
        return True
    tokens = [t for t in _split_tokens(stripped) if t]
    if len(tokens) < 2:
        return True
    if not all(_is_letter_token(token) for token in tokens):
        return True
    return any(token.lower() in _SERVICE_WORDS for token in tokens[:3])


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
        if ch in {"'", "ʼ", "’", "`", "‘", "´", "-"}:
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


# How each letter can appear in a UKMA mailbox.
_TRANSLITERATION = {
    "а": ("a",),
    "б": ("b",),
    "в": ("v", "w"),
    "г": ("h", "g"),
    "ґ": ("g",),
    "д": ("d",),
    "е": ("e",),
    "є": ("ye", "ie", "e"),
    "ж": ("zh", "j", "z"),
    "з": ("z", "s"),
    "и": ("y", "i", "e"),
    "і": ("i", "y"),
    "ї": ("yi", "i", "ji"),
    "й": ("y", "i", "j"),
    "к": ("k", "c"),
    "л": ("l",),
    "м": ("m",),
    "н": ("n",),
    "о": ("o",),
    "п": ("p",),
    "р": ("r",),
    "с": ("s", "c"),
    "т": ("t",),
    "у": ("u", "ou"),
    "ф": ("f", "ph"),
    "х": ("kh", "h", "x", "ch"),
    "ц": ("ts", "c", "tz"),
    "ч": ("ch", "tch"),
    "ш": ("sh", "sch"),
    "щ": ("shch", "sch", "sh"),
    "ь": ("",),
    "ю": ("yu", "iu", "ju", "u"),
    "я": ("ya", "ia", "ja", "a"),
}
_MIN_SURNAME_SEGMENT_LENGTH = 3
_MAX_INITIAL_SEGMENT_LENGTH = 2
_MIN_MATCH = 2
_MIN_MARGIN = 2


def _match_length(token: str, segment: str) -> int:
    """How many characters of the mailbox segment this token can spell."""
    reachable = {0}
    matched = 0
    for char in token.lower():
        spellings = _TRANSLITERATION.get(char)
        if spellings is None:
            spellings = (char,) if char.isalnum() else ("",)
        advanced = {
            position + len(spelling)
            for position in reachable
            for spelling in spellings
            if segment.startswith(spelling, position)
        }
        if not advanced:
            break
        reachable = advanced
        matched = max(reachable)
    return matched


def _order_by_mailbox(tokens: list[str], upn_local: str) -> tuple[str, str] | None:
    """Which of the two words is the surname, per the mailbox. None if unclear."""
    local = upn_local.lower().strip()
    if "." not in local:
        return None

    initial_segment, surname_segment = local.rsplit(".", 1)
    if len(surname_segment) < _MIN_SURNAME_SEGMENT_LENGTH:
        return None
    if len(initial_segment) > _MAX_INITIAL_SEGMENT_LENGTH:
        return None

    scored = sorted(
        ((_match_length(token, surname_segment), token) for token in tokens),
        key=lambda pair: pair[0],
        reverse=True,
    )
    (best, last_name), (runner_up, _) = scored
    if best < _MIN_MATCH or best - runner_up < _MIN_MARGIN:
        return None
    return next(t for t in tokens if t is not last_name), last_name


def _parse_name(display_name: str, upn_local: str = "") -> tuple[str, str, str]:
    """Return (first_name, patronymic, last_name).

    Ukrainian display names mostly follow `Last First [Patronymic]`, Latin ones
    `First Last`. Detection is based on the first alphabetic character of the
    displayName.

    Part of the export writes Cyrillic names the other way round, as
    `First Last`, and with only two tokens nothing in the string itself gives
    the order away. `upn_local` resolves those against the mailbox; a third
    token means the name is already `Last First Patronymic` and is trusted.
    """
    tokens = [t for t in display_name.strip().split() if t]
    if not tokens:
        return "", "", ""

    first_letter = next((ch for ch in display_name if ch.isalpha()), "")
    if _is_cyrillic(first_letter):
        last_name = tokens[0]
        first_name = tokens[1] if len(tokens) > 1 else ""
        patronymic = tokens[2] if len(tokens) > 2 else ""
        if len(tokens) == 2 and upn_local:
            ordered = _order_by_mailbox(tokens, upn_local)
            if ordered is not None:
                first_name, last_name = ordered
        return first_name, patronymic, last_name

    if len(tokens) == 1:
        return tokens[0], "", ""
    return tokens[0], "", " ".join(tokens[1:])


def _names_from_row(row: dict[str, str], email: str) -> dict[str, str] | None:
    first_name, patronymic, last_name = _parse_name(row["displayName"], email.split("@", 1)[0])
    if not last_name and not first_name:
        return None
    return {"first_name": first_name, "last_name": last_name, "patronymic": patronymic}


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
            "--refresh-names",
            action="store_true",
            help=(
                "Also rewrite the names of people already in the directory. Off by "
                "default: the export is inconsistent about name order, so corrections "
                "made here would be undone on the next run."
            ),
        )

    @transaction.atomic
    def handle(self, *args, **options):
        csv_path: str = options["csv_path"]
        dry_run: bool = options["dry_run"]
        refresh_names: bool = options["refresh_names"]

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

        created, updated, kept_as_is = self._upsert(candidates, dry_run, refresh_names)
        logger.info(
            "instructors_ingest_complete",
            created=created,
            updated=updated,
            kept_as_is=kept_as_is,
            refresh_names=refresh_names,
            dry_run=dry_run,
        )

        if dry_run:
            self.stdout.write(self.style.WARNING("Dry run — no changes made."))
            transaction.set_rollback(True)
        else:
            self.stdout.write(
                self.style.SUCCESS(
                    f"Done. created={created} updated={updated} kept_as_is={kept_as_is}"
                )
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
                raise CommandError(f"CSV missing required columns: {', '.join(missing)}")
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

    def _upsert(
        self,
        candidates: list[dict[str, str]],
        dry_run: bool,
        refresh_names: bool,
    ) -> tuple[int, int, int]:
        """Add people; leave the ones already here alone, so hand fixes survive."""
        created = 0
        updated = 0
        kept_as_is = 0
        for row in candidates:
            email = (row["userPrincipalName"] or "").lower()
            names = _names_from_row(row, email)
            if names is None:
                continue

            if not Instructor.objects.filter(email=email).exists():
                created += 1
            elif refresh_names:
                updated += 1
            else:
                kept_as_is += 1
                continue

            if not dry_run:
                Instructor.objects.update_or_create(email=email, defaults=names)
        return created, updated, kept_as_is
