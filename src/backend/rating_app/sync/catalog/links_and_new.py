"""Propose catalog links and new rows from a UKMA Data snapshot.

Rules: M1 and M2 match offerings and courses; M5 places a new offering on its
course (or asks); M6 creates a course only when nothing holds its identity; M8
skips and counts rows Rate UKMA cannot store; M12 derives a new course's status
and description; M14 maps a UKMA Data term to a Rate UKMA semester.
"""

from __future__ import annotations

from collections import defaultdict
from collections.abc import Sequence
from decimal import Decimal

from rating_app.application_schemas import ukma_data_api as ukma
from rating_app.sync.constants import (
    CREDITS_OUT_OF_RANGE,
    IDENTITY_COLLISION,
    MAX_NAME,
    NO_DEPARTMENT,
    NO_TERM,
    TITLE_TOO_LONG,
    UNKNOWN_PROGRAMME,
)
from rating_app.sync.drafts import ChangeDraft, DecisionView, make_before
from rating_app.sync.kinds import KIND_BY_NAME
from rating_app.sync.matching import (
    academic_year_of,
    course_majority,
    courses_by_ud,
    exam_type_of,
    match_departments,
    match_faculties,
    match_offerings,
    offering_skip_reason,
    resolve_course,
    semester_of,
)
from rating_app.sync.payloads import (
    PAYLOADS,
    CourseDisplay,
    Display,
    TeacherYear,
    UkmaCourseDisplay,
)
from rating_app.sync.snapshot import RateUkmaSnapshot, RuOffering, UkmaDataSnapshot

_KIND_BY_PROGRAMME_KIND = {
    ukma.Kind2.compulsory: "COMPULSORY",
    ukma.Kind2.prof_oriented: "PROF_ORIENTED",
    ukma.Kind2.elective: "ELECTIVE",
}


def propose_links_and_new(
    ud: UkmaDataSnapshot,
    ru: RateUkmaSnapshot,
    decisions: Sequence[DecisionView],
    *,
    academic_year: int,
) -> tuple[list[ChangeDraft], dict[str, list[str]]]:
    """Link matched rows, create new ones and ask where an offering belongs."""
    return _Builder(ud, ru, decisions, academic_year).build()


class _Builder:
    def __init__(
        self,
        ud: UkmaDataSnapshot,
        ru: RateUkmaSnapshot,
        decisions: Sequence[DecisionView],
        academic_year: int,
    ) -> None:
        self.ud = ud
        self.ru = ru
        self.decisions = decisions
        self.academic_year = academic_year

        self.faculty_match = match_faculties(ud, ru)
        self.department_match = match_departments(ud, ru)
        self.offering_match = match_offerings(ud, ru)
        self.majority = course_majority(ud, ru, self.offering_match)
        self.majority_groups = courses_by_ud(self.majority)
        self.stored_by_ud: dict[str, list[str]] = defaultdict(list)
        for course_id, course in ru.courses.items():
            if course.ukma_data_id is not None:
                self.stored_by_ud[course.ukma_data_id].append(course_id)

        self.drafts: list[ChangeDraft] = []
        self.skipped: dict[str, set[str]] = defaultdict(set)
        self.new_faculties: set[str] = set()
        self.new_departments: set[str] = set()
        self.department_ready: set[str] = set()
        self.new_courses: set[str] = set()
        self.identity_links: dict[str, str] = {}
        self.course_reasons: dict[str, str] = {}

        self._cards: dict[str, CourseDisplay] = {}
        self._new_cards: dict[str, CourseDisplay] = {}
        self._ru_offerings: dict[str, list[RuOffering]] = defaultdict(list)
        for offering in ru.offerings.values():
            self._ru_offerings[offering.course_id].append(offering)
        self._ud_offerings: dict[str, list[ukma.Offering]] = defaultdict(list)
        for offering in sorted(ud.offerings.values(), key=lambda row: row.id):
            if offering.removed_at is not None or offering.course_id is None:
                continue
            course_id = resolve_course(ud, offering.course_id)
            if course_id is not None:
                self._ud_offerings[course_id].append(offering)
        self._offering_reasons: dict[str, str | None] = {
            offering.id: self._offering_reason(offering)
            for offering in ud.offerings.values()
            if offering.removed_at is None
        }

    def build(self) -> tuple[list[ChangeDraft], dict[str, list[str]]]:
        self._match_faculties()
        self._match_departments()
        self._match_courses()
        self._link_courses()
        self._propose_offerings()
        self._link_offerings()

        drafts = sorted(self.drafts, key=lambda draft: (KIND_BY_NAME[draft.kind].order, draft.key))
        return drafts, {reason: sorted(ids) for reason, ids in self.skipped.items()}

    # Faculties and departments (M10)

    def _match_faculties(self) -> None:
        for faculty in sorted(self.ud.faculties.values(), key=lambda row: row.id):
            if faculty.removed_at is not None:
                continue
            target = self.faculty_match.get(faculty.id)
            if target is not None:
                if self.ru.faculties[target].ukma_data_id is None:
                    self._link("link_faculty", target, faculty.id, Display(name=faculty.name))
                continue
            if len(faculty.name) > MAX_NAME:
                self._skip(TITLE_TOO_LONG, faculty.id)
                continue
            self.new_faculties.add(faculty.id)
            self._add(
                "new_faculty",
                key=faculty.id,
                ukma_data_id=faculty.id,
                after={"name": faculty.name},
                display=Display(name=faculty.name),
            )

    def _match_departments(self) -> None:
        for department in sorted(self.ud.departments.values(), key=lambda row: row.id):
            if department.removed_at is not None:
                continue
            target = self.department_match.get(department.id)
            if target is not None:
                if self.ru.departments[target].ukma_data_id is None:
                    self._link(
                        "link_department", target, department.id, Display(name=department.name)
                    )
                self.department_ready.add(department.id)
                continue
            if len(department.name) > MAX_NAME:
                self._skip(TITLE_TOO_LONG, department.id)
                continue
            faculty_id = department.faculty_id
            if faculty_id is None or not self._faculty_ready(faculty_id):
                continue
            requires = (
                [{"kind": "new_faculty", "key": faculty_id}]
                if faculty_id in self.new_faculties
                else []
            )
            self.new_departments.add(department.id)
            self.department_ready.add(department.id)
            self._add(
                "new_department",
                key=department.id,
                ukma_data_id=department.id,
                after={"name": department.name, "faculty_ukma_id": faculty_id},
                requires=requires,
                display=Display(name=department.name),
            )

    def _faculty_ready(self, faculty_id: str) -> bool:
        faculty = self.ud.faculties.get(faculty_id)
        if faculty is None or faculty.removed_at is not None:
            return False
        return faculty_id in self.faculty_match or faculty_id in self.new_faculties

    def _department_ready(self, department_id: str | None) -> bool:
        return department_id is not None and department_id in self.department_ready

    # Courses (M2, M6, M12)

    def _match_courses(self) -> None:
        identities = self._identities()
        claimed: set[str] = set()
        for course in sorted(self.ud.courses.values(), key=lambda row: row.id):
            if course.removed_at is not None or course.merged_into is not None:
                continue
            storable = [
                offering
                for offering in self._ud_offerings.get(course.id, [])
                if self._offering_reasons[offering.id] is None
            ]
            unmatched = [
                offering for offering in storable if offering.id not in self.offering_match
            ]
            if not unmatched:
                continue
            if self._stored_courses(course.id) or self.majority_groups.get(course.id):
                continue

            department_id = (
                self.department_match.get(course.department_id)
                if course.department_id is not None
                else None
            )
            identity = (
                identities.get((course.title, department_id, self._level(course)))
                if department_id is not None
                else None
            )
            if identity is not None:
                if (
                    identity in claimed
                    or identity in self.majority
                    or self.ru.courses[identity].ukma_data_id is not None
                ):
                    self._skip_course(course, unmatched, IDENTITY_COLLISION)
                    continue
                claimed.add(identity)
                self.identity_links[course.id] = identity
                continue

            reason = self._new_course_reason(course)
            if reason is not None:
                self._skip_course(course, unmatched, reason)
                continue
            self.new_courses.add(course.id)
            department_ukma_id = course.department_id
            assert department_ukma_id is not None  # checked by _new_course_reason
            requires = (
                [{"kind": "new_department", "key": department_ukma_id}]
                if department_ukma_id in self.new_departments
                else []
            )
            self._add(
                "new_course",
                key=course.id,
                ukma_data_id=course.id,
                after={
                    "title": course.title,
                    "level": self._level(course),
                    "department_ukma_id": department_ukma_id,
                    "status": self._status(course.id),
                    "description": self._description(course.id),
                },
                requires=requires,
                display=Display(course=self._new_course_card(course)),
            )

    def _identities(self) -> dict[tuple[str, str, str], str]:
        identities: dict[tuple[str, str, str], str] = {}
        for course_id in sorted(self.ru.courses):
            course = self.ru.courses[course_id]
            identities.setdefault(
                (course.title, course.department_id, course.education_level), course_id
            )
        return identities

    def _new_course_reason(self, course: ukma.Course) -> str | None:
        if len(course.title) > MAX_NAME:
            return TITLE_TOO_LONG
        if not self._department_ready(course.department_id):
            return NO_DEPARTMENT
        return None

    def _skip_course(
        self, course: ukma.Course, offerings: list[ukma.Offering], reason: str
    ) -> None:
        self.course_reasons[course.id] = reason
        self._skip(reason, course.id)
        for offering in offerings:
            self._skip(reason, offering.id)

    def _status(self, course_id: str) -> str:
        years = [offering.academic_year for offering in self._ud_offerings.get(course_id, [])]
        return "ACTIVE" if years and max(years) >= self.academic_year else "FINISHED"

    def _description(self, course_id: str) -> str:
        offerings = self._ud_offerings.get(course_id, [])
        if not offerings:
            return ""
        latest = max(offerings, key=lambda offering: (offering.academic_year, offering.id))
        return latest.annotation or ""

    @staticmethod
    def _level(course: ukma.Course) -> str:
        return course.level.value.upper()

    def _stored_courses(self, ud_course_id: str) -> list[str]:
        return sorted(self.stored_by_ud.get(ud_course_id, []))

    # Links (M1, M2, M10)

    def _link_courses(self) -> None:
        for course_id in sorted(self.ru.courses):
            course = self.ru.courses[course_id]
            if course.ukma_data_id is not None:
                continue
            ud_course_id = self.majority.get(course_id)
            if ud_course_id is None:
                continue
            if not self._links_in_group(course_id, ud_course_id):
                continue
            self._link(
                "link_course",
                course_id,
                ud_course_id,
                Display(course=self._course_card(course_id)),
                course.ratings,
            )
        for ud_course_id, course_id in sorted(self.identity_links.items()):
            self._link(
                "link_course",
                course_id,
                ud_course_id,
                Display(course=self._course_card(course_id)),
                self.ru.courses[course_id].ratings,
            )

    def _links_in_group(self, course_id: str, ud_course_id: str) -> bool:
        """A course alone on its UKMA Data course links; several link only once a
        live merge decision answers them: each for keep apart, the target for a merge (M3)."""
        group = self.majority_groups.get(ud_course_id, [])
        if len(group) <= 1:
            return True
        course = self.ud.courses.get(ud_course_id)
        if course is None:
            return False
        decision = self._merge_decision(course, group)
        if decision is None:
            return False
        if decision.answer == "keep_apart":
            return True
        return decision.answer == "merge" and decision.into_id == course_id

    def _link_offerings(self) -> None:
        for ud_offering_id, ru_offering_id in sorted(self.offering_match.items()):
            offering = self.ru.offerings[ru_offering_id]
            if offering.ukma_data_id is not None:
                continue
            course = self.ru.courses.get(offering.course_id)
            display = Display(course=self._course_card(course.id)) if course else Display()
            self._link("link_offering", ru_offering_id, ud_offering_id, display, offering.ratings)

    # Offerings (M5, M8, M14)

    def _propose_offerings(self) -> None:
        for offering in sorted(self.ud.offerings.values(), key=lambda row: row.id):
            if offering.removed_at is not None or offering.id in self.offering_match:
                continue
            reason = self._offering_reasons.get(offering.id)
            if reason is not None:
                self._skip(reason, offering.id)
                continue
            if offering.course_id is None:
                continue
            course_id = resolve_course(self.ud, offering.course_id)
            if course_id is None:
                continue
            course = self.ud.courses[course_id]
            candidates = self._candidates(course)
            if not candidates and course_id in self.new_courses:
                self._new_offering(
                    offering,
                    course_ukma_id=course_id,
                    requires=[{"kind": "new_course", "key": course_id}],
                    display=Display(course=self._new_course_card(course)),
                )
                continue
            if not candidates:
                self._skip(self.course_reasons.get(course_id, NO_DEPARTMENT), offering.id)
                continue
            target = self._place(course, offering, candidates)
            if target is None:
                self._place_question(offering, course, candidates)
            else:
                self._new_offering(
                    offering,
                    course_id=target,
                    display=Display(course=self._course_card(target)),
                )

    def _candidates(self, course: ukma.Course) -> list[str]:
        candidates = set(self._stored_courses(course.id))
        candidates.update(self.majority_groups.get(course.id, []))
        identity = self.identity_links.get(course.id)
        if identity is not None:
            candidates.add(identity)
        return sorted(candidates)

    def _place(
        self, course: ukma.Course, offering: ukma.Offering, candidates: list[str]
    ) -> str | None:
        if len(candidates) == 1:
            return candidates[0]

        decision = self._question("place_offering", offering.id, "place")
        if (
            decision is not None
            and decision.into_id in candidates
            and self._premise_holds(decision, course, candidates)
        ):
            return decision.into_id

        merge = self._merge_decision(course, candidates)
        if merge is not None:
            if merge.answer == "merge":
                return merge.into_id if merge.into_id in candidates else None
            return self._department_candidate(offering, candidates)
        if len(self.majority_groups.get(course.id, [])) > 1:
            return None
        return self._department_candidate(offering, candidates)

    def _department_candidate(self, offering: ukma.Offering, candidates: list[str]) -> str | None:
        department_id = self.department_match.get(offering.department_id or "")
        if department_id is None:
            return None
        matches = [
            course_id
            for course_id in candidates
            if self.ru.courses[course_id].department_id == department_id
        ]
        return matches[0] if len(matches) == 1 else None

    def _merge_decision(self, course: ukma.Course, candidates: list[str]) -> DecisionView | None:
        decision = self._question("merge_courses", course.id)
        if decision is None or not self._premise_holds(decision, course, candidates):
            return None
        return decision

    def _new_offering(
        self,
        offering: ukma.Offering,
        *,
        course_id: str | None = None,
        course_ukma_id: str | None = None,
        requires: list[dict[str, str]] | None = None,
        display: Display,
    ) -> None:
        after = self._offering_after(offering)
        if course_id is not None:
            after["course_id"] = course_id
            ratings = self.ru.courses[course_id].ratings
        else:
            after["course_ukma_id"] = course_ukma_id
            ratings = 0
        self._add(
            "new_offering",
            key=offering.id,
            ukma_data_id=offering.id,
            after=after,
            requires=requires or [],
            ratings=ratings,
            display=display,
        )

    def _place_question(
        self, offering: ukma.Offering, course: ukma.Course, candidates: list[str]
    ) -> None:
        after = self._offering_after(offering)
        after["candidates"] = candidates
        self._add(
            "place_offering",
            key=offering.id,
            ukma_data_id=course.id,
            after=after,
            ratings=sum(self.ru.courses[course_id].ratings for course_id in candidates),
            display=Display(
                courses=[self._course_card(course_id) for course_id in candidates],
                ukma_course=self._ukma_course_card(course),
            ),
        )

    def _offering_after(self, offering: ukma.Offering) -> dict[str, object]:
        items = sorted(offering.terms, key=lambda item: semester_of(self.ud.terms[item.term_id]))
        terms = [self._term_payload(item) for item in items]
        last = terms[-1]
        return {
            "saz_code": offering.saz_code,
            "semester": {"year": last["year"], "term": last["term"]},
            "exam_type": last["exam_type"],
            "study_year": offering.study_year,
            "max_students": offering.max_students,
            "max_groups": offering.max_groups,
            "group_size_min": offering.group_size_min,
            "group_size_max": offering.group_size_max,
            "terms": terms,
            "specialities": self._specialities(offering),
        }

    def _term_payload(self, item: ukma.OfferingTerm) -> dict[str, object]:
        year, season = semester_of(self.ud.terms[item.term_id])
        practice_count, practice_type = _practice(item)
        return {
            "year": year,
            "term": str(season),
            "credits": f"{Decimal(str(item.credits)):.1f}",
            "weekly_hours": item.hours_per_week or 0,
            "lecture_count": item.lecture_hours,
            "practice_count": practice_count,
            "practice_type": practice_type,
            "exam_type": exam_type_of(item.control),
        }

    def _specialities(self, offering: ukma.Offering) -> list[dict[str, str]]:
        kinds: dict[str, str] = {}
        for link in sorted(offering.programmes, key=lambda item: item.programme_id):
            programme = self.ud.programmes.get(link.programme_id)
            if programme is None or programme.removed_at is not None:
                continue
            kinds.setdefault(programme.name, _KIND_BY_PROGRAMME_KIND[link.kind])
        return [{"name": name, "kind": kinds[name]} for name in sorted(kinds)]

    def _offering_reason(self, offering: ukma.Offering) -> str | None:
        if any(not Decimal(str(term.credits)).is_finite() for term in offering.terms):
            return CREDITS_OUT_OF_RANGE
        reason = offering_skip_reason(offering)
        if reason is not None:
            return reason
        if any(item.term_id not in self.ud.terms for item in offering.terms):
            return NO_TERM
        for link in offering.programmes:
            programme = self.ud.programmes.get(link.programme_id)
            if programme is None:
                return UNKNOWN_PROGRAMME
            if programme.removed_at is None and programme.name not in self.ru.speciality_names:
                return UNKNOWN_PROGRAMME
        return None

    # Decisions (M15)

    def _question(self, kind: str, key: str, *answers: str) -> DecisionView | None:
        for decision in self.decisions:
            if (
                decision.kind == kind
                and decision.question_key == key
                and (not answers or decision.answer in answers)
            ):
                return decision
        return None

    def _premise_holds(
        self, decision: DecisionView, course: ukma.Course, candidates: list[str]
    ) -> bool:
        premise = decision.premise
        course_ids = premise.get("course_ids")
        if not isinstance(course_ids, list):
            return False
        if sorted(str(value) for value in course_ids) != candidates:
            return False
        if "ukma_course_id" not in premise or str(premise["ukma_course_id"]) != course.id:
            return False
        if "merge_source" not in premise or premise["merge_source"] != _merge_source(course):
            return False
        if "ratings" not in premise:
            return False
        ratings = premise["ratings"]
        current = {course_id: self.ru.courses[course_id].ratings for course_id in candidates}
        if isinstance(ratings, dict):
            try:
                return {str(key): int(str(value)) for key, value in ratings.items()} == current
            except (TypeError, ValueError):
                return False
        if isinstance(ratings, int):
            return ratings == sum(current.values())
        return False

    # Drafts and display (shared contract)

    def _add(
        self,
        kind: str,
        *,
        key: str,
        after: dict[str, object],
        ukma_data_id: str | None = None,
        target_id: str | None = None,
        requires: list[dict[str, str]] | None = None,
        ratings: int = 0,
        display: Display,
    ) -> None:
        dumped = display.model_dump()
        PAYLOADS[kind].model_validate({**after, "display": dumped})
        self.drafts.append(
            ChangeDraft(
                kind=kind,
                key=key,
                ukma_data_id=ukma_data_id,
                target_id=target_id,
                before=make_before(kind, self.ru, target_id, after),
                after=after,
                requires=requires or [],
                ratings=ratings,
                display=dumped,
            )
        )

    def _link(
        self,
        kind: str,
        target_id: str,
        ud_id: str,
        display: Display,
        ratings: int = 0,
    ) -> None:
        self._add(
            kind,
            key=target_id,
            ukma_data_id=ud_id,
            target_id=target_id,
            after={"ukma_data_id": ud_id},
            ratings=ratings,
            display=display,
        )

    def _skip(self, reason: str, row_id: str) -> None:
        self.skipped[reason].add(row_id)

    def _course_card(self, course_id: str) -> CourseDisplay:
        card = self._cards.get(course_id)
        if card is not None:
            return card
        course = self.ru.courses[course_id]
        department = self.ru.departments.get(course.department_id)
        offerings = self._ru_offerings.get(course_id, [])
        teachers: dict[int, set[str]] = defaultdict(set)
        for offering in offerings:
            year = academic_year_of(offering.semester_year, offering.semester_term)
            for link in offering.instructor_links:
                instructor = self.ru.instructors.get(link.instructor_id)
                if instructor is not None:
                    teachers[year].add(instructor.name)
        card = CourseDisplay(
            title=course.title,
            department=department.name if department is not None else "",
            years=sorted(
                {
                    academic_year_of(offering.semester_year, offering.semester_term)
                    for offering in offerings
                }
            ),
            saz_codes=sorted(offering.code for offering in offerings),
            teachers=[
                TeacherYear(year=year, teachers=sorted(teachers[year])) for year in sorted(teachers)
            ],
        )
        self._cards[course_id] = card
        return card

    def _new_course_card(self, course: ukma.Course) -> CourseDisplay:
        card = self._new_cards.get(course.id)
        if card is not None:
            return card
        department = (
            self.ud.departments.get(course.department_id)
            if course.department_id is not None
            else None
        )
        offerings = self._ud_offerings.get(course.id, [])
        card = CourseDisplay(
            title=course.title,
            department=department.name if department is not None else "",
            years=sorted({offering.academic_year for offering in offerings}),
            saz_codes=sorted(offering.saz_code for offering in offerings),
            teachers=[],
        )
        self._new_cards[course.id] = card
        return card

    def _ukma_course_card(self, course: ukma.Course) -> UkmaCourseDisplay:
        department = (
            self.ud.departments.get(course.department_id)
            if course.department_id is not None
            else None
        )
        return UkmaCourseDisplay(
            title=course.title,
            department=department.name if department is not None else None,
            merge_source=_merge_source(course),
        )


def _practice(item: ukma.OfferingTerm) -> tuple[int | None, str]:
    if item.seminar_hours:
        return item.seminar_hours, "SEMINAR"
    if item.practice_hours:
        return item.practice_hours, "PRACTICE"
    return None, ""


def _merge_source(course: ukma.Course) -> str | None:
    return course.merge_source.value if course.merge_source is not None else None
