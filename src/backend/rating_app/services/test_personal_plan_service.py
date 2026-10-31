import uuid
from decimal import Decimal
from unittest.mock import MagicMock

import pytest
from freezegun import freeze_time

from rating_app.application_schemas.personal_plan import (
    MandatoryCourse,
    OfferingTermLoad,
    PlanCoursePutParams,
    PlanCourseSource,
    PlannedCourseEntry,
    PlanOffering,
    TakenCourse,
)
from rating_app.application_schemas.student import Student
from rating_app.models.choices import CourseTypeKind, PlanSlot, PlanYearStatus, SemesterTerm
from rating_app.services.personal_plan_service import PersonalPlanService
from rating_app.services.semester_service import SemesterService

TODAY = "2024-10-15"
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
        id=uuid.uuid4(),
        year=year,
        term=term,
        loads=(OfferingTermLoad(year=year, term=term, credits=Decimal(credits), weekly_hours=2),),
        kinds=kinds or {},
    )


def _make_multi_term_offering(*terms: tuple[int, SemesterTerm, str]) -> PlanOffering:
    year, term, _ = terms[0]
    return PlanOffering(
        id=uuid.uuid4(),
        year=year,
        term=term,
        loads=tuple(
            OfferingTermLoad(year=y, term=t, credits=Decimal(credits), weekly_hours=2)
            for y, t, credits in terms
        ),
    )


def _make_course(*offerings: PlanOffering) -> PlanCourseSource:
    return PlanCourseSource(
        course_id=uuid.uuid4(), title="Курс", faculty_name="ФІ", offerings=offerings
    )


def _make_pick(
    course: PlanCourseSource,
    study_year: int = 3,
    term: SemesterTerm = SemesterTerm.FALL,
    slot: PlanSlot = PlanSlot.MAIN,
) -> PlannedCourseEntry:
    return PlannedCourseEntry(
        course=course, offering=course.offerings[0], study_year=study_year, term=term, slot=slot
    )


def _semester(plan, study_year: int, term: SemesterTerm):
    year = plan.plan_years[study_year - 1]
    return next(s for s in year.semesters if s.semester_term == term)


@pytest.fixture
def plan_repo():
    repo = MagicMock()
    repo.get_taken_courses.return_value = []
    repo.get_planned_courses.return_value = []
    repo.get_mandatory_courses.return_value = []
    return repo


@pytest.fixture
def service(plan_repo):
    return PersonalPlanService(
        personal_plan_repository=plan_repo,
        semester_service=SemesterService(semester_repository=MagicMock()),
    )


@freeze_time(TODAY)
def test_get_plan_starts_at_current_year_when_student_has_no_history(service):
    plan = service.get_plan(_make_student())

    assert plan.enrollment_year_start == 2024
    assert [year.year_status for year in plan.plan_years] == [
        PlanYearStatus.CURRENT,
        PlanYearStatus.PLANNED,
        PlanYearStatus.PLANNED,
        PlanYearStatus.PLANNED,
    ]


@freeze_time(TODAY)
def test_get_plan_adds_years_when_taken_courses_run_past_the_fourth(service, plan_repo):
    first = _make_offering(2019, SemesterTerm.FALL)
    last = _make_offering(2024, SemesterTerm.FALL)
    plan_repo.get_taken_courses.return_value = [
        TakenCourse(course=_make_course(first), offering=first),
        TakenCourse(course=_make_course(last), offering=last),
    ]

    plan = service.get_plan(_make_student())

    assert len(plan.plan_years) == 6
    assert _semester(plan, 6, SemesterTerm.SUMMER).is_graduation_summer is True
    assert _semester(plan, 4, SemesterTerm.SUMMER).is_graduation_summer is False


@freeze_time(TODAY)
def test_get_plan_merges_current_year_without_duplicating_taken_courses(service, plan_repo):
    offering = _make_offering(
        2024, SemesterTerm.FALL, kinds={SPECIALITY_ID: CourseTypeKind.COMPULSORY}
    )
    course = _make_course(offering)
    other = _make_course(_make_offering(2023, SemesterTerm.FALL))
    plan_repo.get_taken_courses.return_value = [TakenCourse(course=course, offering=offering)]
    plan_repo.get_planned_courses.return_value = [
        _make_pick(course, study_year=1, slot=PlanSlot.BACKUP),
        _make_pick(other, study_year=1),
    ]

    plan = service.get_plan(_make_student())

    fall = _semester(plan, 1, SemesterTerm.FALL)
    assert [(c.course_id, c.is_mandatory, c.type_kind) for c in fall.main] == [
        (course.course_id, True, CourseTypeKind.COMPULSORY),
        (other.course_id, False, CourseTypeKind.ELECTIVE),
    ]
    assert fall.backup == []


@freeze_time(TODAY)
def test_get_plan_shows_only_taken_courses_in_past_years(service, plan_repo):
    stale = _make_course(_make_offering(2023, SemesterTerm.FALL))
    plan_repo.get_planned_courses.return_value = [_make_pick(stale, study_year=1)]

    plan = service.get_plan(_make_student(program_start=2023))

    assert _semester(plan, 1, SemesterTerm.FALL).main == []


@freeze_time(TODAY)
def test_get_plan_hides_pick_taken_in_another_semester(service, plan_repo):
    offering = _make_offering(2024, SemesterTerm.FALL)
    course = _make_course(offering)
    plan_repo.get_taken_courses.return_value = [TakenCourse(course=course, offering=offering)]
    plan_repo.get_planned_courses.return_value = [_make_pick(course, study_year=3)]

    plan = service.get_plan(_make_student())

    assert _semester(plan, 3, SemesterTerm.FALL).main == []
    assert [c.course_id for c in _semester(plan, 1, SemesterTerm.FALL).main] == [course.course_id]


@freeze_time(TODAY)
def test_get_plan_puts_multi_semester_pick_in_each_semester_with_its_credits(service, plan_repo):
    offering = _make_multi_term_offering(
        (2023, SemesterTerm.FALL, "4.0"), (2024, SemesterTerm.SPRING, "2.5")
    )
    plan_repo.get_planned_courses.return_value = [
        _make_pick(_make_course(offering), term=SemesterTerm.SPRING, slot=PlanSlot.BACKUP)
    ]

    plan = service.get_plan(_make_student(program_start=2023))

    assert [c.credits for c in _semester(plan, 3, SemesterTerm.FALL).backup] == [Decimal("4.0")]
    assert [c.credits for c in _semester(plan, 3, SemesterTerm.SPRING).backup] == [Decimal("2.5")]


@freeze_time(TODAY)
def test_get_plan_carries_multi_year_pick_into_the_next_study_year(service, plan_repo):
    offering = _make_multi_term_offering(
        (2023, SemesterTerm.SPRING, "3.0"), (2023, SemesterTerm.FALL, "3.0")
    )
    plan_repo.get_planned_courses.return_value = [_make_pick(_make_course(offering))]

    plan = service.get_plan(_make_student(program_start=2023))

    assert len(_semester(plan, 3, SemesterTerm.SPRING).main) == 1
    assert len(_semester(plan, 4, SemesterTerm.FALL).main) == 1


@freeze_time(TODAY)
def test_get_plan_shows_taken_multi_semester_course_in_each_semester(service, plan_repo):
    offering = _make_multi_term_offering(
        (2023, SemesterTerm.FALL, "4.0"), (2024, SemesterTerm.SPRING, "2.5")
    )
    plan_repo.get_taken_courses.return_value = [
        TakenCourse(course=_make_course(offering), offering=offering)
    ]

    plan = service.get_plan(_make_student(program_start=2023))

    assert [c.credits for c in _semester(plan, 1, SemesterTerm.FALL).main] == [Decimal("4.0")]
    assert [c.credits for c in _semester(plan, 1, SemesterTerm.SPRING).main] == [Decimal("2.5")]


def _make_mandatory(
    course: PlanCourseSource, offering: PlanOffering, study_year: int = 3
) -> MandatoryCourse:
    return MandatoryCourse(course=course, offering=offering, study_year=study_year)


def _compulsory_offering(year: int, credits: str = "3.0") -> PlanOffering:
    return _make_offering(
        year,
        SemesterTerm.FALL,
        credits=credits,
        kinds={SPECIALITY_ID: CourseTypeKind.COMPULSORY},
    )


@freeze_time(TODAY)
def test_get_plan_shows_mandatory_course_in_its_study_year(service, plan_repo):
    offering = _compulsory_offering(2024)
    course = _make_course()
    plan_repo.get_mandatory_courses.return_value = [_make_mandatory(course, offering)]

    plan = service.get_plan(_make_student(program_start=2023))

    assert [
        (c.course_id, c.type_kind, c.is_mandatory)
        for c in _semester(plan, 3, SemesterTerm.FALL).main
    ] == [(course.course_id, CourseTypeKind.COMPULSORY, True)]


@freeze_time(TODAY)
def test_get_plan_shows_unfinished_mandatory_course_in_past_year(service, plan_repo):
    offering = _compulsory_offering(2023)
    course = _make_course()
    plan_repo.get_mandatory_courses.return_value = [_make_mandatory(course, offering, study_year=1)]

    plan = service.get_plan(_make_student(program_start=2023))

    assert [c.course_id for c in _semester(plan, 1, SemesterTerm.FALL).main] == [course.course_id]


@freeze_time(TODAY)
def test_get_plan_shows_taken_mandatory_course_once(service, plan_repo):
    taken_offering = _make_offering(2024, SemesterTerm.FALL)
    course = _make_course()
    plan_repo.get_taken_courses.return_value = [TakenCourse(course=course, offering=taken_offering)]
    plan_repo.get_mandatory_courses.return_value = [
        _make_mandatory(course, _compulsory_offering(2024))
    ]

    plan = service.get_plan(_make_student())

    assert _semester(plan, 3, SemesterTerm.FALL).main == []
    assert [c.course_id for c in _semester(plan, 1, SemesterTerm.FALL).main] == [course.course_id]


@freeze_time(TODAY)
def test_get_plan_uses_latest_curriculum_for_years_the_cohort_has_not_reached(service, plan_repo):
    current = _make_course()
    dropped = _make_course()
    plan_repo.get_mandatory_courses.return_value = [
        _make_mandatory(dropped, _compulsory_offering(2022)),
        _make_mandatory(current, _compulsory_offering(2024)),
    ]

    plan = service.get_plan(_make_student(program_start=2023))

    assert [c.course_id for c in _semester(plan, 3, SemesterTerm.FALL).main] == [current.course_id]


@freeze_time(TODAY)
def test_get_plan_uses_cohort_curriculum_for_years_already_reached(service, plan_repo):
    cohort = _make_course()
    newer = _make_course()
    plan_repo.get_mandatory_courses.return_value = [
        _make_mandatory(newer, _compulsory_offering(2024), study_year=1),
        _make_mandatory(cohort, _compulsory_offering(2023), study_year=1),
    ]

    plan = service.get_plan(_make_student(program_start=2023))

    assert [c.course_id for c in _semester(plan, 1, SemesterTerm.FALL).main] == [cohort.course_id]


@freeze_time(TODAY)
def test_get_plan_lists_course_once_when_mandatory_in_two_offerings(service, plan_repo):
    course = _make_course()
    plan_repo.get_mandatory_courses.return_value = [
        _make_mandatory(course, _compulsory_offering(2024, credits="2.0")),
        _make_mandatory(course, _make_offering(2025, SemesterTerm.SPRING, credits="5.0")),
    ]

    plan = service.get_plan(_make_student(program_start=2023))

    planned = [c for year in plan.plan_years for semester in year.semesters for c in semester.main]
    assert [c.credits for c in planned] == [Decimal("5.0")]


@freeze_time(TODAY)
def test_get_plan_hides_pick_of_a_mandatory_course(service, plan_repo):
    course = _make_course(_make_offering(2024, SemesterTerm.SPRING))
    plan_repo.get_mandatory_courses.return_value = [
        _make_mandatory(course, _compulsory_offering(2024))
    ]
    plan_repo.get_planned_courses.return_value = [_make_pick(course, term=SemesterTerm.SPRING)]

    plan = service.get_plan(_make_student(program_start=2023))

    assert _semester(plan, 3, SemesterTerm.SPRING).main == []


@freeze_time(TODAY)
def test_get_plan_starts_from_first_taken_course_when_programme_start_is_earlier(
    service, plan_repo
):
    offering = _make_offering(2023, SemesterTerm.FALL)
    plan_repo.get_taken_courses.return_value = [
        TakenCourse(course=_make_course(offering), offering=offering)
    ]

    plan = service.get_plan(_make_student(program_start=2021))

    assert plan.enrollment_year_start == 2023
    assert len(plan.plan_years) == 4


@freeze_time(TODAY)
def test_get_plan_starts_from_first_taken_course_when_programme_start_is_later(service, plan_repo):
    offering = _make_offering(2022, SemesterTerm.FALL)
    plan_repo.get_taken_courses.return_value = [
        TakenCourse(course=_make_course(offering), offering=offering)
    ]

    plan = service.get_plan(_make_student(program_start=2023))

    assert plan.enrollment_year_start == 2022


@freeze_time(TODAY)
def test_get_plan_uses_programme_start_when_student_has_no_history(service):
    plan = service.get_plan(_make_student(program_start=2023))

    assert plan.enrollment_year_start == 2023


def _place(service, plan_repo, course: PlanCourseSource) -> uuid.UUID:
    """Places the course and returns the offering id the service stored."""
    plan_repo.get_course_source.return_value = course
    params = PlanCoursePutParams(
        course_id=course.course_id,
        study_year=3,
        semester_term=SemesterTerm.FALL,
        slot=PlanSlot.MAIN,
    )

    service.place_course(_make_student(program_start=2023), params)

    return plan_repo.place.call_args.args[2]


@freeze_time(TODAY)
def test_place_course_prefers_professional_offering_over_newer_one(service, plan_repo):
    professional = _make_offering(
        2023, SemesterTerm.FALL, kinds={SPECIALITY_ID: CourseTypeKind.PROF_ORIENTED}
    )
    course = _make_course(professional, _make_offering(2025, SemesterTerm.FALL))

    assert _place(service, plan_repo, course) == professional.id


@freeze_time(TODAY)
def test_place_course_picks_newest_of_several_professional_offerings(service, plan_repo):
    kinds = {SPECIALITY_ID: CourseTypeKind.PROF_ORIENTED}
    newest = _make_offering(2024, SemesterTerm.FALL, kinds=kinds)
    course = _make_course(
        _make_offering(2022, SemesterTerm.FALL, kinds=kinds),
        newest,
        _make_offering(2023, SemesterTerm.FALL, kinds=kinds),
    )

    assert _place(service, plan_repo, course) == newest.id


@freeze_time(TODAY)
def test_place_course_ignores_offerings_professional_for_another_speciality(service, plan_repo):
    newest = _make_offering(2024, SemesterTerm.FALL)
    course = _make_course(
        _make_offering(2023, SemesterTerm.FALL, kinds={uuid.uuid4(): CourseTypeKind.PROF_ORIENTED}),
        newest,
    )

    assert _place(service, plan_repo, course) == newest.id


@freeze_time(TODAY)
def test_place_course_picks_newest_offering_when_none_is_professional(service, plan_repo):
    newest = _make_offering(2024, SemesterTerm.FALL)
    course = _make_course(newest, _make_offering(2023, SemesterTerm.FALL))

    assert _place(service, plan_repo, course) == newest.id
