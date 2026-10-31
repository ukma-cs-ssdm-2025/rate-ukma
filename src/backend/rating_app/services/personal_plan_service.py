import uuid
from collections import defaultdict

import structlog

from rating_app.application_schemas.personal_plan import (
    MandatoryCourse,
    OfferingTermLoad,
    PersonalPlan,
    PlanCourse,
    PlanCoursePutParams,
    PlanCourseSource,
    PlannedCourseEntry,
    PlanOffering,
    PlanSemester,
    PlanTimeline,
    PlanYear,
    SemesterCourses,
    TakenCourse,
)
from rating_app.application_schemas.student import Student
from rating_app.exception.course_exceptions import CourseNotFoundError
from rating_app.exception.personal_plan_exceptions import (
    CourseAlreadyTakenError,
    CourseIsMandatoryError,
    CourseNotOfferedError,
    PlannedCourseNotFoundError,
    PlanSemesterUnavailableError,
)
from rating_app.models.choices import CourseTypeKind, PlanSlot, PlanYearStatus, SemesterTerm
from rating_app.repositories import PersonalPlanRepository
from rating_app.services.semester_service import SemesterService

logger = structlog.get_logger(__name__)

SemesterKey = tuple[int, SemesterTerm]


class PersonalPlanService:
    STUDY_YEARS = 4
    PLAN_TERMS = (SemesterTerm.FALL, SemesterTerm.SPRING, SemesterTerm.SUMMER)

    def __init__(
        self,
        personal_plan_repository: PersonalPlanRepository,
        semester_service: SemesterService,
    ) -> None:
        self.personal_plan_repository = personal_plan_repository
        self.semester_service = semester_service

    def get_plan(self, student: Student) -> PersonalPlan:
        taken = self.personal_plan_repository.get_taken_courses(student.id)
        planned = self.personal_plan_repository.get_planned_courses(student.id)

        timeline = self._build_timeline(student, taken)
        mandatory = self._mandatory_courses(student, timeline, taken)

        # A pick that became taken or mandatory stays out of the plan, whatever its semester.
        fixed_ids = {item.course.course_id for item in [*taken, *mandatory]}
        picks = [entry for entry in planned if entry.course.course_id not in fixed_ids]

        fixed_by_key = self._group_fixed(student, timeline, taken, mandatory)
        planned_by_key = self._group_planned(student, picks)

        return PersonalPlan(
            enrollment_year_start=timeline.enrollment_year_start,
            current_year_start=timeline.current_year_start,
            plan_years=[
                self._build_year(timeline, study_year, fixed_by_key, planned_by_key)
                for study_year in range(1, timeline.year_count + 1)
            ],
        )

    def place_course(self, student: Student, params: PlanCoursePutParams) -> PersonalPlan:
        course = self.personal_plan_repository.get_course_source(params.course_id)
        if course is None:
            raise CourseNotFoundError()
        offering = self._pick_offering(course.offerings, student.speciality_id)
        if offering is None:
            raise CourseNotOfferedError()

        taken = self.personal_plan_repository.get_taken_courses(student.id)
        timeline = self._build_timeline(student, taken)
        self._ensure_not_fixed(student, timeline, taken, params.course_id)

        semesters = self._course_semesters(offering, params.study_year, params.semester_term)
        if not all(self._can_plan(timeline, year, term) for (year, term), _ in semesters):
            raise PlanSemesterUnavailableError()

        self.personal_plan_repository.place(student.id, params, offering.id)
        logger.info(
            "planned_course_placed",
            student_id=str(student.id),
            course_id=str(params.course_id),
            offering_id=str(offering.id),
            study_year=params.study_year,
            term=params.semester_term,
            slot=params.slot,
        )
        return self.get_plan(student)

    def remove_course(self, student: Student, course_id: uuid.UUID) -> None:
        taken = self.personal_plan_repository.get_taken_courses(student.id)
        timeline = self._build_timeline(student, taken)
        self._ensure_not_fixed(student, timeline, taken, course_id)

        if not self.personal_plan_repository.remove(student.id, course_id):
            raise PlannedCourseNotFoundError()
        logger.info("planned_course_removed", student_id=str(student.id), course_id=str(course_id))

    def _ensure_not_fixed(
        self,
        student: Student,
        timeline: PlanTimeline,
        taken: list[TakenCourse],
        course_id: uuid.UUID,
    ) -> None:
        if any(item.course.course_id == course_id for item in taken):
            raise CourseAlreadyTakenError()
        mandatory = self._mandatory_courses(student, timeline, taken)
        if any(item.course.course_id == course_id for item in mandatory):
            raise CourseIsMandatoryError()

    def _mandatory_courses(
        self, student: Student, timeline: PlanTimeline, taken: list[TakenCourse]
    ) -> list[MandatoryCourse]:
        """
        The programme's mandatory courses the student has not taken.
        The curriculum changes every year, so each study year uses the list from the
        year the student reaches it. Future years have no data yet, so they use the
        latest list available.
        """
        by_semester: dict[SemesterKey, list[MandatoryCourse]] = defaultdict(list)
        for item in self.personal_plan_repository.get_mandatory_courses(
            student.speciality_id, student.education_level
        ):
            by_semester[(item.study_year, item.offering.term)].append(item)

        taken_ids = {item.course.course_id for item in taken}
        by_course: dict[uuid.UUID, MandatoryCourse] = {}
        for (study_year, _), items in by_semester.items():
            cohort_start = timeline.enrollment_year_start + study_year - 1
            starts = {self._offering_year_start(item.offering) for item in items}
            year_start = max((s for s in starts if s <= cohort_start), default=min(starts))
            for item in items:
                course_id = item.course.course_id
                if (
                    course_id not in taken_ids
                    and self._offering_year_start(item.offering) == year_start
                ):
                    by_course[course_id] = self._newer_mandatory(by_course.get(course_id), item)
        return list(by_course.values())

    def _newer_mandatory(
        self, current: MandatoryCourse | None, candidate: MandatoryCourse
    ) -> MandatoryCourse:
        if current is None:
            return candidate
        newest = self._newest_offering([current.offering, candidate.offering])
        return current if newest is current.offering else candidate

    def _offering_year_start(self, offering: PlanOffering) -> int:
        return self.semester_service.get_academic_year_start(offering.year, offering.term)

    def _build_timeline(self, student: Student, taken: list[TakenCourse]) -> PlanTimeline:
        current_start = self.semester_service.get_current_academic_year_start()
        starts = [self._load_year_start(load) for t in taken for load in t.offering.loads]
        # САЗ history comes first: the stored programme start is often years off. A
        # student with neither is a first-year.
        fallback_start = student.program_start_academic_year_start or current_start
        enrollment_start = min(starts, default=fallback_start)
        last_taken_year = max((start - enrollment_start + 1 for start in starts), default=0)
        return PlanTimeline(
            enrollment_year_start=enrollment_start,
            current_year_start=current_start,
            year_count=max(self.STUDY_YEARS, last_taken_year),
        )

    def _load_year_start(self, load: OfferingTermLoad) -> int:
        return self.semester_service.get_academic_year_start(load.year, load.term)

    def _year_status(self, timeline: PlanTimeline, study_year: int) -> PlanYearStatus:
        return self.semester_service.get_academic_year_status(
            timeline.enrollment_year_start + study_year - 1
        )

    def _is_graduation_summer(
        self, timeline: PlanTimeline, study_year: int, term: SemesterTerm
    ) -> bool:
        return term == SemesterTerm.SUMMER and study_year == timeline.year_count

    def _can_plan(self, timeline: PlanTimeline, study_year: int, term: SemesterTerm) -> bool:
        return (
            1 <= study_year <= timeline.year_count
            and self._year_status(timeline, study_year) != PlanYearStatus.DONE
            and not self._is_graduation_summer(timeline, study_year, term)
        )

    def _group_fixed(
        self,
        student: Student,
        timeline: PlanTimeline,
        taken: list[TakenCourse],
        mandatory: list[MandatoryCourse],
    ) -> dict[SemesterKey, list[PlanCourse]]:
        by_key: dict[SemesterKey, list[PlanCourse]] = defaultdict(list)
        for item in taken:
            for load in item.offering.loads:
                study_year = self.semester_service.get_study_year(
                    timeline.enrollment_year_start, load.year, load.term
                )
                by_key[(study_year, load.term)].append(
                    self._build_course(student, item.course, item.offering, load, is_mandatory=True)
                )
        for item in mandatory:
            semesters = self._course_semesters(item.offering, item.study_year, item.offering.term)
            for key, load in semesters:
                by_key[key].append(
                    self._build_course(student, item.course, item.offering, load, is_mandatory=True)
                )
        return by_key

    def _group_planned(
        self, student: Student, planned: list[PlannedCourseEntry]
    ) -> dict[SemesterKey, SemesterCourses]:
        by_key: dict[SemesterKey, SemesterCourses] = defaultdict(
            lambda: SemesterCourses(main=[], backup=[])
        )
        for entry in planned:
            semesters = self._course_semesters(entry.offering, entry.study_year, entry.term)
            for key, load in semesters:
                course = self._build_course(
                    student, entry.course, entry.offering, load, is_mandatory=False
                )
                semester = by_key[key]
                (semester.main if entry.slot == PlanSlot.MAIN else semester.backup).append(course)
        return by_key

    def _course_semesters(
        self, offering: PlanOffering, study_year: int, term: SemesterTerm
    ) -> list[tuple[SemesterKey, OfferingTermLoad]]:
        """
        Where a planned course lands. A course that runs over several semesters goes
        to all of them from the chosen study year, whichever term was picked.
        """
        if len(offering.loads) == 1:
            return [((study_year, term), offering.loads[0])]
        first_start = min(self._load_year_start(load) for load in offering.loads)
        return [
            ((study_year + self._load_year_start(load) - first_start, load.term), load)
            for load in offering.loads
        ]

    def _build_year(
        self,
        timeline: PlanTimeline,
        study_year: int,
        fixed_by_key: dict[SemesterKey, list[PlanCourse]],
        planned_by_key: dict[SemesterKey, SemesterCourses],
    ) -> PlanYear:
        status = self._year_status(timeline, study_year)
        semesters = []
        for term in self.PLAN_TERMS:
            key = (study_year, term)
            courses = self._semester_courses(
                status,
                fixed_by_key.get(key, []),
                planned_by_key.get(key, SemesterCourses(main=[], backup=[])),
            )
            semesters.append(
                PlanSemester(
                    semester_term=term,
                    is_graduation_summer=self._is_graduation_summer(timeline, study_year, term),
                    main=courses.main,
                    backup=courses.backup,
                )
            )
        return PlanYear(
            study_year=study_year,
            academic_year_start=timeline.enrollment_year_start + study_year - 1,
            year_status=status,
            semesters=semesters,
        )

    def _semester_courses(
        self, status: PlanYearStatus, fixed: list[PlanCourse], picks: SemesterCourses
    ) -> SemesterCourses:
        if status == PlanYearStatus.DONE:
            return SemesterCourses(main=fixed, backup=[])
        return SemesterCourses(main=fixed + picks.main, backup=picks.backup)

    def _build_course(
        self,
        student: Student,
        course: PlanCourseSource,
        offering: PlanOffering,
        load: OfferingTermLoad,
        is_mandatory: bool,
    ) -> PlanCourse:
        return PlanCourse(
            course_id=course.course_id,
            title=course.title,
            type_kind=self._course_kind(offering, student.speciality_id),
            faculty_name=course.faculty_name,
            credits=load.credits,
            weekly_hours=load.weekly_hours,
            is_mandatory=is_mandatory,
        )

    def _pick_offering(
        self, offerings: tuple[PlanOffering, ...], speciality_id: uuid.UUID
    ) -> PlanOffering | None:
        """The newest offering that is professional for the speciality, else the newest one."""
        professional = [
            offering
            for offering in offerings
            if offering.kinds.get(speciality_id) == CourseTypeKind.PROF_ORIENTED
        ]
        return self._newest_offering(professional) or self._newest_offering(list(offerings))

    def _newest_offering(self, offerings: list[PlanOffering]) -> PlanOffering | None:
        return max(
            offerings,
            key=lambda offering: (offering.year, SemesterService.TERM_PRIORITY[offering.term]),
            default=None,
        )

    def _course_kind(self, offering: PlanOffering, speciality_id: uuid.UUID) -> CourseTypeKind:
        """
        How the course counts for the student's own speciality. A course their
        speciality does not list is one they took from elsewhere: free choice.
        """
        return offering.kinds.get(speciality_id, CourseTypeKind.ELECTIVE)
