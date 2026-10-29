import uuid
from datetime import date
from decimal import Decimal

from rating_app.application_schemas.personal_plan import (
    OfferingTermLoad,
    PlanCourseSource,
    PlannedCourseEntry,
    PlanOffering,
    TakenCourse,
)
from rating_app.application_schemas.student import Student
from rating_app.models.choices import CourseTypeKind, PlanSlot, PlanYearStatus, SemesterTerm
from rating_app.services.personal_plan_service import build_plan, offering_for_term

TODAY = date(2024, 10, 15)
SPECIALITY_ID = uuid.uuid4()


def _make_student(program_start: int | None = None) -> Student:
    return Student(
        id=uuid.uuid4(),
        first_name="Тест",
        last_name="Студент",
        patronymic=None,
        education_level=None,
        speciality_id=SPECIALITY_ID,
        program_start_academic_year_start=program_start,
    )


def _make_offering(
    year: int,
    term: SemesterTerm,
    credits: str = "3.0",
    kinds: dict[uuid.UUID, CourseTypeKind] | None = None,
) -> PlanOffering:
    return PlanOffering(
        year=year,
        term=term,
        loads=(OfferingTermLoad(term=term, credits=Decimal(credits), weekly_hours=2),),
        kinds=kinds or {},
    )


def _make_course(*offerings: PlanOffering) -> PlanCourseSource:
    return PlanCourseSource(
        course_id=uuid.uuid4(), title="Курс", faculty_name="ФІ", offerings=offerings
    )


def _semester(plan, study_year: int, term: SemesterTerm):
    year = plan.years[study_year - 1]
    return next(s for s in year.semesters if s.term == term)


def test_offering_for_term_picks_newest_offering_in_that_term():
    old_spring = _make_offering(2022, SemesterTerm.SPRING, credits="2.0")
    new_spring = _make_offering(2024, SemesterTerm.SPRING, credits="4.0")
    newer_fall = _make_offering(2025, SemesterTerm.FALL, credits="6.0")

    result = offering_for_term((old_spring, newer_fall, new_spring), SemesterTerm.SPRING)

    assert result is new_spring


def test_offering_for_term_falls_back_to_newest_when_term_not_offered():
    fall = _make_offering(2023, SemesterTerm.FALL)
    newer_fall = _make_offering(2024, SemesterTerm.FALL)

    result = offering_for_term((newer_fall, fall), SemesterTerm.SUMMER)

    assert result is newer_fall


def test_build_plan_starts_at_current_year_when_student_has_no_history():
    plan = build_plan(_make_student(), taken=[], planned=[], today=TODAY)

    assert plan.enrollment_year_start == 2024
    assert [year.status for year in plan.years] == [
        PlanYearStatus.CURRENT,
        PlanYearStatus.PLANNED,
        PlanYearStatus.PLANNED,
        PlanYearStatus.PLANNED,
    ]


def test_build_plan_adds_years_when_taken_courses_run_past_the_fourth():
    offering = _make_offering(2024, SemesterTerm.FALL)
    taken = [TakenCourse(course=_make_course(offering), offering=offering)]

    plan = build_plan(_make_student(program_start=2019), taken=taken, planned=[], today=TODAY)

    assert len(plan.years) == 6
    assert _semester(plan, 6, SemesterTerm.SUMMER).is_graduation_summer is True
    assert _semester(plan, 4, SemesterTerm.SUMMER).is_graduation_summer is False


def test_build_plan_merges_current_year_without_duplicating_taken_courses():
    offering = _make_offering(
        2024, SemesterTerm.FALL, kinds={SPECIALITY_ID: CourseTypeKind.COMPULSORY}
    )
    course = _make_course(offering)
    other = _make_course(_make_offering(2023, SemesterTerm.FALL))
    taken = [TakenCourse(course=course, offering=offering)]
    planned = [
        PlannedCourseEntry(
            course=course, study_year=2, term=SemesterTerm.FALL, slot=PlanSlot.BACKUP
        ),
        PlannedCourseEntry(course=other, study_year=2, term=SemesterTerm.FALL, slot=PlanSlot.MAIN),
    ]

    plan = build_plan(_make_student(program_start=2023), taken=taken, planned=planned, today=TODAY)

    fall = _semester(plan, 2, SemesterTerm.FALL)
    assert [(c.course_id, c.is_mandatory, c.kind) for c in fall.main] == [
        (course.course_id, True, CourseTypeKind.COMPULSORY),
        (other.course_id, False, CourseTypeKind.ELECTIVE),
    ]
    assert fall.backup == []


def test_build_plan_shows_only_taken_courses_in_past_years():
    stale = _make_course(_make_offering(2023, SemesterTerm.FALL))
    planned = [
        PlannedCourseEntry(course=stale, study_year=1, term=SemesterTerm.FALL, slot=PlanSlot.MAIN)
    ]

    plan = build_plan(_make_student(program_start=2023), taken=[], planned=planned, today=TODAY)

    assert _semester(plan, 1, SemesterTerm.FALL).main == []


def test_build_plan_skips_picks_whose_course_is_no_longer_offered():
    gone = _make_course()
    planned = [
        PlannedCourseEntry(course=gone, study_year=3, term=SemesterTerm.FALL, slot=PlanSlot.MAIN)
    ]

    plan = build_plan(_make_student(program_start=2023), taken=[], planned=planned, today=TODAY)

    assert _semester(plan, 3, SemesterTerm.FALL).main == []
