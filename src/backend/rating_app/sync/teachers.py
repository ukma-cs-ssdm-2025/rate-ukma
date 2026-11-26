"""Read UKMA Data's planned teachers and record one run of changes.

The run reads the current and the previous academic year from
``/v1/offerings/instructors``, compares each offering it finds by САЗ code with
the offering's ``CourseInstructor`` rows, and records ``teacher_created`` for an
email Rate UKMA does not know, ``teacher_link_added`` and
``teacher_link_removed``. It writes no link itself: the apply writes them, by a
superuser's approval or a kind's policy. Before anything is recorded, a short
read of a year fails the run.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import Any, Protocol

from rating_app.application_schemas import ukma_data_api as ud
from rating_app.application_schemas.ukma_data_params import (
    UKMA_DATA_MAX_PAGE_SIZE,
    UkmaDataPageParams,
)
from rating_app.models import Instructor, SyncChange, SyncRun, SyncRunStatus, SyncSource
from rating_app.models.choices import InstructorRole
from rating_app.repositories.instructor_repository import current_academic_year_start
from rating_app.sync.drafts import ChangeDraft
from rating_app.sync.errors import ShortReadError, StalledReadError
from rating_app.sync.runs import finish_run
from rating_app.sync.snapshot import RateUkmaSnapshot, RuOffering, load_rate_ukma_snapshot

# A year is short when UKMA Data lists under 90% of what the last run matched,
# or wants under 90% of the links those offerings have.
SHORT_READ_RATIO = 0.9
INSTRUCTORS_SCOPE = "instructors:read"

ROLES: dict[str, tuple[InstructorRole, ...]] = {
    "lecturer": (InstructorRole.LECTURE_INSTRUCTOR,),
    "practice_teacher": (InstructorRole.PRACTICUM_INSTRUCTOR,),
    "lecturer_and_practice_teacher": (
        InstructorRole.LECTURE_INSTRUCTOR,
        InstructorRole.PRACTICUM_INSTRUCTOR,
    ),
}


class TeacherReader(Protocol):
    def list_offering_instructors(
        self, params: UkmaDataPageParams, *, year: int
    ) -> ud.OfferingTeachersPage: ...


@dataclass(frozen=True)
class Teacher:
    id: str
    email: str
    name: str


@dataclass
class YearTally:
    listed: int = 0
    matched: int = 0
    links: int = 0
    wanted: int = 0


def record_teacher_run(run: SyncRun, reader: TeacherReader) -> SyncRun:
    """Read both years, guard, compare and record; no teacher link is written."""
    current = current_academic_year_start()
    years = [current - 1, current]
    listed = {year: read_offering_teachers(reader, year) for year in years}
    changes, counts = build_teacher_changes(listed, load_rate_ukma_snapshot(), years)

    short = short_read_years(counts, _last_succeeded_counts())
    if short:
        raise ShortReadError(short)

    run.cursor_from = {"after": 0}
    run.cursor_to = {"after": _max_change_no(listed)}
    run.save(update_fields=["cursor_from", "cursor_to"])
    return finish_run(run, changes, counts)


def read_offering_teachers(reader: TeacherReader, year: int) -> dict[str, ud.OfferingTeachers]:
    """Every row UKMA Data lists for a year, the newest copy of a САЗ code."""
    rows: dict[str, ud.OfferingTeachers] = {}
    after = 0
    while True:
        page = reader.list_offering_instructors(
            UkmaDataPageParams(after=after, limit=UKMA_DATA_MAX_PAGE_SIZE), year=year
        )
        for row in page.items:
            seen = rows.get(row.saz_code)
            if seen is None or row.change_no > seen.change_no:
                rows[row.saz_code] = row
        if not page.has_more:
            return rows
        if page.cursor <= after:
            raise StalledReadError("stalled_read")
        after = page.cursor


def load_known_teachers() -> dict[str, Teacher]:
    """Rate UKMA's teachers by lower-cased email, the key a creation uses."""
    known: dict[str, Teacher] = {}
    rows = Instructor.objects.order_by("id").values(
        "id", "email", "last_name", "first_name", "patronymic"
    )
    for row in rows:
        email = (row["email"] or "").strip().lower()
        if email and email not in known:
            known[email] = Teacher(
                id=str(row["id"]),
                email=email,
                name=_name(row["last_name"], row["first_name"], row["patronymic"]),
            )
    return known


def build_teacher_changes(
    listed: Mapping[int, Mapping[str, ud.OfferingTeachers]],
    ru: RateUkmaSnapshot,
    years: Sequence[int],
    *,
    known: Mapping[str, Teacher] | None = None,
) -> tuple[list[SyncChange], dict[str, Any]]:
    """The run's changes and its counts; the database is read, never written."""
    known = load_known_teachers() if known is None else known
    by_code = {offering.code: offering for offering in ru.offerings.values()}
    titles = {course.id: course.title for course in ru.courses.values()}
    linked_names = {instructor.id: instructor.name for instructor in ru.instructors.values()}
    emails = {teacher.id: teacher.email for teacher in known.values()}
    names = {teacher.id: teacher.name for teacher in known.values()}

    creations: dict[str, ChangeDraft] = {}
    drafts: list[ChangeDraft] = []
    tallies = {year: YearTally() for year in years}
    matched = skipped = created_links = removed_links = no_email = 0

    for year in years:
        tally = tallies[year]
        for code in sorted(listed[year]):
            row = listed[year][code]
            tally.listed += 1
            offering = by_code.get(code)
            if offering is None:
                skipped += 1
                continue
            matched += 1
            tally.matched += 1

            listed_teachers = [] if row.removed_at is not None else row.instructors
            wanted = _wanted_links(listed_teachers, known)
            no_email += _no_email_count(listed_teachers)
            for email, teacher in wanted.creations.items():
                creations.setdefault(email, _creation(email, teacher))

            current = {(link.instructor_id, link.role) for link in offering.instructor_links}
            if row.removed_at is None:
                tally.links += len(current)
                tally.wanted += len(wanted.known) + len(wanted.unknown)
            before = _links_before(offering)
            title = titles.get(offering.course_id, "")

            for instructor_id, role in sorted(current - wanted.known):
                drafts.append(
                    ChangeDraft(
                        kind="teacher_link_removed",
                        key=f"offering:{offering.id}|remove:{instructor_id}|role:{role}",
                        target_id=offering.id,
                        before=before,
                        after={"instructor_id": instructor_id, "role": role},
                        display={
                            "name": title,
                            "teacher": {"name": linked_names.get(instructor_id, "")},
                        },
                        ratings=offering.ratings,
                    )
                )
                removed_links += 1

            for instructor_id, role in sorted(wanted.known - current):
                drafts.append(
                    ChangeDraft(
                        kind="teacher_link_added",
                        key=f"offering:{offering.id}|teacher:{emails[instructor_id]}|role:{role}",
                        target_id=offering.id,
                        before=before,
                        after={"teacher_email": emails[instructor_id], "role": role},
                        display={
                            "name": title,
                            "teacher": {"name": names[instructor_id]},
                        },
                        ratings=offering.ratings,
                    )
                )
                created_links += 1

            for email, role in sorted(wanted.unknown):
                drafts.append(
                    ChangeDraft(
                        kind="teacher_link_added",
                        key=f"offering:{offering.id}|teacher:{email}|role:{role}",
                        target_id=offering.id,
                        before=before,
                        after={"teacher_email": email, "role": role},
                        display={
                            "name": title,
                            "teacher": {"name": _unknown_name(wanted.creations, email)},
                        },
                        requires=[{"kind": "teacher_created", "key": email}],
                        ratings=offering.ratings,
                    )
                )
                created_links += 1

    counts: dict[str, Any] = {
        "matched": matched,
        "skipped": skipped,
        "created": len(creations),
        "linked": created_links,
        "removed": removed_links,
        "no_email": no_email,
        "years": {
            str(year): {
                "listed": tally.listed,
                "matched": tally.matched,
                "links": tally.links,
                "wanted": tally.wanted,
            }
            for year, tally in tallies.items()
        },
    }
    return [draft.to_model() for draft in (*creations.values(), *drafts)], counts


def short_read_years(counts: Mapping[str, Any], previous: Mapping[str, Any]) -> list[int]:
    """Years where UKMA Data lists too few offerings, or wants too few links.

    The offerings guard compares this run's matched count with the last
    succeeded teacher run's, so it needs a previous run that has the year; the
    links guard compares what UKMA Data wants with the links that exist now, so
    it always runs, including the first run after a deploy.
    """
    current_years = counts.get("years")
    current_years = current_years if isinstance(current_years, Mapping) else {}
    previous_years = previous.get("years")
    previous_years = previous_years if isinstance(previous_years, Mapping) else {}
    short: list[int] = []
    for year, now in current_years.items():
        if not isinstance(now, Mapping):
            continue
        before = previous_years.get(year)
        matched = now.get("matched", 0)
        if isinstance(before, Mapping) and matched < before.get("matched", 0) * SHORT_READ_RATIO:
            short.append(int(year))
        elif now.get("wanted", 0) < now.get("links", 0) * SHORT_READ_RATIO:
            short.append(int(year))
    return sorted(short)


@dataclass(frozen=True)
class _WantedLinks:
    known: set[tuple[str, str]]
    unknown: set[tuple[str, str]]
    creations: dict[str, ud.OfferingInstructor]


def _wanted_links(
    listed: Sequence[ud.OfferingInstructor], known: Mapping[str, Teacher]
) -> _WantedLinks:
    resolved: set[tuple[str, str]] = set()
    unknown: set[tuple[str, str]] = set()
    creations: dict[str, ud.OfferingInstructor] = {}
    for teacher in listed:
        email = (teacher.email or "").strip().lower()
        if not email:
            continue
        instructor = known.get(email)
        if instructor is None:
            creations.setdefault(email, teacher)
        for role in ROLES[teacher.role]:
            if instructor is None:
                unknown.add((email, role.value))
            else:
                resolved.add((instructor.id, role.value))
    return _WantedLinks(known=resolved, unknown=unknown, creations=creations)


def _no_email_count(listed: Sequence[ud.OfferingInstructor]) -> int:
    return sum(1 for teacher in listed if not (teacher.email or "").strip())


def _links_before(offering: RuOffering) -> dict[str, object]:
    return {
        "links": [
            {"instructor_id": link.instructor_id, "role": link.role}
            for link in sorted(
                offering.instructor_links, key=lambda link: (link.instructor_id, link.role)
            )
        ]
    }


def _creation(email: str, teacher: ud.OfferingInstructor) -> ChangeDraft:
    return ChangeDraft(
        kind="teacher_created",
        key=email,
        after={
            "email": email,
            "last_name": teacher.last_name,
            "first_name": teacher.first_name,
            "middle_name": teacher.middle_name or "",
        },
        display={
            "teacher": {"name": _name(teacher.last_name, teacher.first_name, teacher.middle_name)}
        },
    )


def _unknown_name(creations: Mapping[str, ud.OfferingInstructor], email: str) -> str:
    teacher = creations.get(email)
    if teacher is None:
        return ""
    return _name(teacher.last_name, teacher.first_name, teacher.middle_name)


def _name(*parts: str | None) -> str:
    return " ".join(part for part in parts if part)


def _last_succeeded_counts() -> dict[str, Any]:
    counts = (
        SyncRun.objects.filter(source=SyncSource.TEACHERS, status=SyncRunStatus.SUCCEEDED)
        .order_by("-pk")
        .values_list("counts", flat=True)
        .first()
    )
    return counts if isinstance(counts, dict) else {}


def _max_change_no(listed: Mapping[int, Mapping[str, ud.OfferingTeachers]]) -> int:
    return max(
        (row.change_no for year in listed.values() for row in year.values()),
        default=0,
    )
