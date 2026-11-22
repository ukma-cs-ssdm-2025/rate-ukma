"""Propose catalog mapping questions from UKMA Data (M3, M4, M13, M15).

Pure over the two snapshots. Mapping questions carry in ``after`` everything a
later answer records as its premise: the Rate UKMA course ids and their ratings,
the UKMA Data course id and its ``mergeSource``. A live decision whose premise
no longer matches is ignored, so the question is asked again.

Keys follow the key contract: ``merge_courses`` is keyed by the UKMA Data course
id; ``relink_course`` and ``move_offering`` by the Rate UKMA row. A move's
``requires`` names the ``link_course`` of its Rate UKMA destination when the
same run links it.
"""

from __future__ import annotations

from collections import defaultdict
from collections.abc import Sequence

from rating_app.application_schemas import ukma_data_api as ukma_data
from rating_app.sync.catalog.common import (
    CatalogIndex,
    course_display,
    department_ref,
    make_draft,
    merge_source,
    sorted_drafts,
    ukma_course_display,
)
from rating_app.sync.drafts import ChangeDraft, DecisionView
from rating_app.sync.matching import (
    course_majority,
    courses_by_ud,
    match_offerings,
    resolve_course,
)
from rating_app.sync.snapshot import RateUkmaSnapshot, RuCourse, UkmaDataSnapshot

# The answers that settle a question for good. A ``merge``, ``move`` or
# ``relink`` answer still needs its change applied, so that question stays
# proposed until the apply changes its premise.
_SETTLING_ANSWERS = {
    "merge_courses": "keep_apart",
    "move_offering": "keep",
    "relink_course": "keep",
}


def propose_mapping_questions(
    ud: UkmaDataSnapshot,
    ru: RateUkmaSnapshot,
    decisions: Sequence[DecisionView],
) -> list[ChangeDraft]:
    """Mapping questions a live decision has not answered, sorted by kind then key."""
    index = CatalogIndex.build(ru)
    offering_match = match_offerings(ud, ru)
    majority = course_majority(ud, ru, offering_match)

    drafts: list[ChangeDraft] = [
        *_relink_questions(index, ud, majority, decisions),
        *_move_questions(index, ud, majority, offering_match, decisions),
        *_merge_questions(index, ud, majority, decisions),
    ]
    return sorted_drafts(drafts)


def _relink_questions(
    index: CatalogIndex,
    ud: UkmaDataSnapshot,
    majority: dict[str, str],
    decisions: Sequence[DecisionView],
) -> list[ChangeDraft]:
    ru = index.ru
    drafts = []
    for course_id in sorted(majority):
        course = ru.courses.get(course_id)
        if course is None or course.ukma_data_id is None:
            continue
        wanted = majority[course_id]
        if wanted == course.ukma_data_id:
            continue
        ud_course = ud.courses.get(wanted)
        if ud_course is None:
            continue
        premise = {
            "course_ids": [course_id],
            "ukma_course_id": wanted,
            "merge_source": merge_source(ud_course),
            "ratings": course.ratings,
        }
        if _answered(decisions, "relink_course", course_id, premise):
            continue
        after: dict[str, object] = {"ukma_data_id": wanted}
        drafts.append(
            make_draft(
                index,
                "relink_course",
                course_id,
                course_id,
                wanted,
                after,
                {
                    "course": course_display(index, course),
                    "ukma_course": ukma_course_display(ud, ud_course),
                },
                ratings=course.ratings,
            )
        )
    return drafts


def _move_questions(
    index: CatalogIndex,
    ud: UkmaDataSnapshot,
    majority: dict[str, str],
    offering_match: dict[str, str],
    decisions: Sequence[DecisionView],
) -> list[ChangeDraft]:
    ru = index.ru
    groups = courses_by_ud(majority)
    linked: dict[str, list[str]] = defaultdict(list)
    for course in ru.courses.values():
        if course.ukma_data_id is not None:
            linked[course.ukma_data_id].append(course.id)

    drafts = []
    for ud_offering_id in sorted(offering_match):
        ud_offering = ud.offerings[ud_offering_id]
        ru_offering = ru.offerings[offering_match[ud_offering_id]]
        if ud_offering.course_id is None:
            continue
        ud_course_id = resolve_course(ud, ud_offering.course_id)
        if ud_course_id is None:
            continue
        source = ru.courses.get(ru_offering.course_id)
        if source is None:
            continue
        current_link = majority.get(source.id) or source.ukma_data_id
        if current_link is None or current_link == ud_course_id:
            continue

        ud_course = ud.courses[ud_course_id]
        destination = _move_destination(
            index,
            ud_course,
            source,
            [
                course_id
                for course_id in linked.get(ud_course_id, [])
                if majority.get(course_id) in (None, ud_course_id)
            ],
            groups.get(ud_course_id, []),
        )
        if destination is None:
            continue
        target_id, after, requires = destination
        premise = {
            "course_ids": [source.id, target_id],
            "ukma_course_id": ud_course_id,
            "merge_source": merge_source(ud_course),
            "saz_code": ru_offering.code,
            "ratings": ru_offering.ratings,
        }
        if _answered(decisions, "move_offering", ru_offering.id, premise):
            continue

        display: dict[str, object] = {
            "ukma_course": ukma_course_display(ud, ud_course),
            "courses": [
                course_display(index, source),
                course_display(index, ru.courses[target_id]),
            ],
        }
        drafts.append(
            make_draft(
                index,
                "move_offering",
                ru_offering.id,
                ru_offering.id,
                ud_course_id,
                after,
                display,
                ratings=ru_offering.ratings,
                requires=requires,
            )
        )
    return drafts


def _move_destination(
    index: CatalogIndex,
    ud_course: ukma_data.Course,
    source: RuCourse,
    linked: Sequence[str],
    group: Sequence[str],
) -> tuple[str, dict[str, object], list[dict[str, str]]] | None:
    """The one course a stray offering can go to, or None.

    A course that already carries the UKMA Data id needs nothing; a lone course
    whose majority is that id waits on the ``link_course`` the same run proposes
    for it. Any other destination (a namesake, a course not created yet) would
    wait on a change no run proposes, so the question waits for a later run.
    """
    targets = [target for target in linked if target != source.id]
    requires: list[dict[str, str]] = []
    if not targets and len(group) == 1 and group[0] != source.id:
        if index.ru.courses[group[0]].ukma_data_id is None:
            targets = [group[0]]
            requires = [{"kind": "link_course", "key": group[0]}]
    if len(targets) != 1:
        return None
    after: dict[str, object] = {
        "from_course": source.id,
        "ukma_course_id": ud_course.id,
        "to_course_id": targets[0],
    }
    return targets[0], after, requires


def _merge_questions(
    index: CatalogIndex,
    ud: UkmaDataSnapshot,
    majority: dict[str, str],
    decisions: Sequence[DecisionView],
) -> list[ChangeDraft]:
    ru = index.ru
    drafts = []
    for ud_id, course_ids in sorted(courses_by_ud(majority).items()):
        if ud_id not in ud.courses:
            continue
        courses = [ru.courses[course_id] for course_id in course_ids if course_id in ru.courses]
        if len(courses) < 2:
            continue
        course_ids = [course.id for course in courses]
        ud_course = ud.courses[ud_id]
        ratings = sum(course.ratings for course in courses)
        premise = {
            "course_ids": list(course_ids),
            "ukma_course_id": ud_id,
            "merge_source": merge_source(ud_course),
            "ratings": ratings,
        }
        if _answered(
            decisions,
            "merge_courses",
            ud_id,
            premise,
            ratings_by_course={course.id: course.ratings for course in courses},
        ):
            continue
        after: dict[str, object] = {
            "merge_source": merge_source(ud_course),
            "courses": [
                {
                    "id": course.id,
                    "title": course.title,
                    "department": department_ref(index, course),
                    "years": index.years(course.id),
                    "ratings": course.ratings,
                }
                for course in courses
            ],
        }
        drafts.append(
            make_draft(
                index,
                "merge_courses",
                ud_id,
                None,
                ud_id,
                after,
                {
                    "courses": [course_display(index, course) for course in courses],
                    "ukma_course": ukma_course_display(ud, ud_course),
                },
                ratings=ratings,
            )
        )
    return drafts


def _answered(
    decisions: Sequence[DecisionView],
    kind: str,
    key: str,
    premise: dict[str, object],
    *,
    ratings_by_course: dict[str, int] | None = None,
) -> bool:
    """A live settling answer whose premise still holds; a changed premise asks
    again. Matches ``links_and_new``: course ids compare as a set, and ratings
    may be stored as a total or per course."""
    for decision in decisions:
        if decision.kind != kind or decision.question_key != key:
            continue
        if decision.answer != _SETTLING_ANSWERS[kind]:
            continue
        if all(
            _premise_value_holds(decision.premise, name, value, ratings_by_course)
            for name, value in premise.items()
        ):
            return True
    return False


def _premise_value_holds(
    stored: dict[str, object],
    name: str,
    value: object,
    ratings_by_course: dict[str, int] | None,
) -> bool:
    if name not in stored:
        return False
    recorded = stored[name]
    if name == "course_ids" and isinstance(recorded, list) and isinstance(value, list):
        return sorted(str(item) for item in recorded) == sorted(str(item) for item in value)
    if name == "ratings" and isinstance(recorded, dict) and ratings_by_course is not None:
        try:
            return {str(k): int(str(v)) for k, v in recorded.items()} == ratings_by_course
        except (TypeError, ValueError):
            return False
    return recorded == value
