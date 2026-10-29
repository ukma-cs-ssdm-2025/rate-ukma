import uuid
from collections import defaultdict
from dataclasses import dataclass
from datetime import date

import structlog

from rating_app.application_schemas.personal_plan import (
    OfferingTermLoad,
    PersonalPlan,
    PlanCourse,
    PlanCoursePutParams,
    PlanCourseSource,
    PlannedCourseEntry,
    PlanOffering,
    PlanSemester,
    PlanYear,
    TakenCourse,
)
from rating_app.application_schemas.student import Student
from rating_app.exception.course_exceptions import CourseNotFoundError
from rating_app.exception.personal_plan_exceptions import (
    CourseAlreadyTakenError,
    CourseNotOfferedError,
    PlannedCourseNotFoundError,
    PlanSemesterUnavailableError,
)
from rating_app.models.choices import CourseTypeKind, PlanSlot, PlanYearStatus, SemesterTerm
from rating_app.repositories import PersonalPlanRepository

logger = structlog.get_logger(__name__)

# Bachelor programme length. Lives here until the backend serves it per speciality.
STUDY_YEARS = 4
PLAN_TERMS = (SemesterTerm.FALL, SemesterTerm.SPRING, SemesterTerm.SUMMER)
SEPTEMBER = 9

# Chronological order of terms within one calendar year.
_TERM_ORDER = {SemesterTerm.SPRING: 0, SemesterTerm.SUMMER: 1, SemesterTerm.FALL: 2}


def academic_year_start(year: int, term: SemesterTerm) -> int:
    return year if term == SemesterTerm.FALL else year - 1


def current_academic_year_start(today: date) -> int:
    return today.year if today.month >= SEPTEMBER else today.year - 1


def offering_for_term(
    offerings: tuple[PlanOffering, ...], term: SemesterTerm
) -> PlanOffering | None:
    """The newest offering that runs in the given term, else the newest one."""

    def newest(candidates: list[PlanOffering]) -> PlanOffering | None:
        return max(
            candidates,
            key=lambda offering: (offering.year, _TERM_ORDER[offering.term]),
            default=None,
        )

    return newest([o for o in offerings if term in o.terms]) or newest(list(offerings))


def offering_load(offering: PlanOffering, term: SemesterTerm) -> OfferingTermLoad:
    """Credits and hours for one semester of an offering."""
    return next((load for load in offering.loads if load.term == term), offering.loads[0])


def course_kind_for(offering: PlanOffering, speciality_id: uuid.UUID) -> CourseTypeKind:
    """
    How the course counts for the student's own speciality. A course their
    speciality does not list is one they took from elsewhere: free choice.
    """
    return offering.kinds.get(speciality_id, CourseTypeKind.ELECTIVE)


def _plan_course(
    course: PlanCourseSource,
    offering: PlanOffering,
    term: SemesterTerm,
    speciality_id: uuid.UUID,
    is_mandatory: bool,
) -> PlanCourse:
    load = offering_load(offering, term)
    return PlanCourse(
        course_id=course.course_id,
        title=course.title,
        kind=course_kind_for(offering, speciality_id),
        faculty_name=course.faculty_name,
        credits=load.credits,
        weekly_hours=load.weekly_hours,
        is_mandatory=is_mandatory,
    )


@dataclass(frozen=True)
class PlanTimeline:
    enrollment_year_start: int
    current_year_start: int
    year_count: int

    def status(self, study_year: int) -> PlanYearStatus:
        start = self.enrollment_year_start + study_year - 1
        if start < self.current_year_start:
            return PlanYearStatus.DONE
        if start == self.current_year_start:
            return PlanYearStatus.CURRENT
        return PlanYearStatus.PLANNED

    def study_year_of(self, year: int, term: SemesterTerm) -> int:
        return academic_year_start(year, term) - self.enrollment_year_start + 1

    def is_graduation_summer(self, study_year: int, term: SemesterTerm) -> bool:
        return term == SemesterTerm.SUMMER and study_year == self.year_count

    def can_plan(self, study_year: int, term: SemesterTerm) -> bool:
        return (
            1 <= study_year <= self.year_count
            and self.status(study_year) != PlanYearStatus.DONE
            and not self.is_graduation_summer(study_year, term)
        )


def build_timeline(student: Student, taken: list[TakenCourse], today: date) -> PlanTimeline:
    current_start = current_academic_year_start(today)
    starts = [academic_year_start(t.offering.year, t.offering.term) for t in taken]
    if student.program_start_academic_year_start is not None:
        starts.append(student.program_start_academic_year_start)
    # A student with no САЗ history yet is a first-year.
    enrollment_start = min(starts, default=current_start)
    last_taken_year = max((start - enrollment_start + 1 for start in starts), default=0)
    return PlanTimeline(
        enrollment_year_start=enrollment_start,
        current_year_start=current_start,
        year_count=max(STUDY_YEARS, last_taken_year),
    )


@dataclass
class _SemesterCourses:
    main: list[PlanCourse]
    backup: list[PlanCourse]


def build_plan(
    student: Student,
    taken: list[TakenCourse],
    planned: list[PlannedCourseEntry],
    today: date,
) -> PersonalPlan:
    """САЗ history for past and current years, the student's picks after that."""
    timeline = build_timeline(student, taken, today)

    taken_by_key: dict[tuple[int, SemesterTerm], list[PlanCourse]] = defaultdict(list)
    for item in taken:
        key = (
            timeline.study_year_of(item.offering.year, item.offering.term),
            item.offering.term,
        )
        taken_by_key[key].append(
            _plan_course(
                item.course,
                item.offering,
                item.offering.term,
                student.speciality_id,
                is_mandatory=True,
            )
        )

    planned_by_key: dict[tuple[int, SemesterTerm], _SemesterCourses] = defaultdict(
        lambda: _SemesterCourses(main=[], backup=[])
    )
    for entry in planned:
        offering = offering_for_term(entry.course.offerings, entry.term)
        if offering is None:
            # Planned while offered; its offerings have gone since.
            logger.warning("planned_course_not_offered", course_id=str(entry.course.course_id))
            continue
        course = _plan_course(
            entry.course,
            offering,
            entry.term,
            student.speciality_id,
            is_mandatory=False,
        )
        semester = planned_by_key[(entry.study_year, entry.term)]
        (semester.main if entry.slot == PlanSlot.MAIN else semester.backup).append(course)

    def semester_courses(status: PlanYearStatus, key: tuple[int, SemesterTerm]) -> _SemesterCourses:
        taken_courses = taken_by_key.get(key, [])
        picks = planned_by_key.get(key, _SemesterCourses(main=[], backup=[]))
        if status == PlanYearStatus.DONE:
            return _SemesterCourses(main=taken_courses, backup=[])
        if status == PlanYearStatus.PLANNED:
            return picks
        # The current year mixes what has started with what is still to pick.
        taken_ids = {course.course_id for course in taken_courses}
        return _SemesterCourses(
            main=taken_courses + [c for c in picks.main if c.course_id not in taken_ids],
            backup=[c for c in picks.backup if c.course_id not in taken_ids],
        )

    years = []
    for study_year in range(1, timeline.year_count + 1):
        status = timeline.status(study_year)
        semesters = []
        for term in PLAN_TERMS:
            courses = semester_courses(status, (study_year, term))
            semesters.append(
                PlanSemester(
                    term=term,
                    is_graduation_summer=timeline.is_graduation_summer(study_year, term),
                    main=courses.main,
                    backup=courses.backup,
                )
            )
        years.append(
            PlanYear(
                study_year=study_year,
                academic_year_start=timeline.enrollment_year_start + study_year - 1,
                status=status,
                semesters=semesters,
            )
        )

    return PersonalPlan(
        enrollment_year_start=timeline.enrollment_year_start,
        current_year_start=timeline.current_year_start,
        years=years,
    )


class PersonalPlanService:
    def __init__(self, personal_plan_repository: PersonalPlanRepository) -> None:
        self.personal_plan_repository = personal_plan_repository

    def get_plan(self, student: Student) -> PersonalPlan:
        return build_plan(
            student,
            taken=self.personal_plan_repository.get_taken_courses(student.id),
            planned=self.personal_plan_repository.get_planned_courses(student.id),
            today=date.today(),
        )

    def place_course(self, student: Student, params: PlanCoursePutParams) -> PersonalPlan:
        """Adds the course to a semester, or moves it there if it is planned elsewhere."""
        course = self.personal_plan_repository.get_course_source(params.course_id)
        if course is None:
            raise CourseNotFoundError()
        if not course.offerings:
            raise CourseNotOfferedError()

        taken = self.personal_plan_repository.get_taken_courses(student.id)
        if any(item.course.course_id == params.course_id for item in taken):
            raise CourseAlreadyTakenError()

        timeline = build_timeline(student, taken, date.today())
        if not timeline.can_plan(params.study_year, params.term):
            raise PlanSemesterUnavailableError()

        self.personal_plan_repository.place(student.id, params)
        logger.info(
            "planned_course_placed",
            student_id=str(student.id),
            course_id=str(params.course_id),
            study_year=params.study_year,
            term=params.term,
            slot=params.slot,
        )
        return self.get_plan(student)

    def remove_course(self, student: Student, course_id: uuid.UUID) -> None:
        if not self.personal_plan_repository.remove(student.id, course_id):
            raise PlannedCourseNotFoundError()
        logger.info("planned_course_removed", student_id=str(student.id), course_id=str(course_id))
