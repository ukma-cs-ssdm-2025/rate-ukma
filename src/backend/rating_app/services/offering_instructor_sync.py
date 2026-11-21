from dataclasses import dataclass, field

from django.db import transaction

import structlog

from rating_app.application_schemas.ukma_data import (
    UKMA_DATA_MAX_PAGE_SIZE,
    UkmaDataOfferingInstructor,
    UkmaDataOfferingInstructors,
    UkmaDataPageParams,
)
from rating_app.models import CourseInstructor, CourseOffering, Instructor
from rating_app.models.choices import InstructorRole
from rating_app.repositories.instructor_repository import current_academic_year_start
from rating_app.services.ukma_data_service import UkmaDataService

logger = structlog.get_logger(__name__)

INSTRUCTORS_SCOPE = "instructors:read"

ROLES: dict[str, tuple[InstructorRole, ...]] = {
    "lecturer": (InstructorRole.LECTURE_INSTRUCTOR,),
    "practice_teacher": (InstructorRole.PRACTICUM_INSTRUCTOR,),
    "lecturer_and_practice_teacher": (
        InstructorRole.LECTURE_INSTRUCTOR,
        InstructorRole.PRACTICUM_INSTRUCTOR,
    ),
}


@dataclass
class SyncReport:
    matched: int = 0
    skipped: int = 0
    created: int = 0
    linked: int = 0
    removed: int = 0
    no_email: int = 0
    years: list[int] = field(default_factory=list)


class OfferingInstructorSync:
    """Mirrors UKMA Data's planned teachers into ``CourseInstructor`` (ADR 0019).

    Reads the current and previous academic year's offerings with their
    teachers from ``/v1/offerings/instructors``, finds the offering by САЗ code
    and the teacher by email, and makes the offering's ``CourseInstructor``
    rows exactly what UKMA Data lists. Safe to run again: a second run with the
    same data changes nothing.
    """

    def __init__(self, ukma_data: UkmaDataService) -> None:
        self.ukma_data = ukma_data

    def has_scope(self) -> bool:
        return INSTRUCTORS_SCOPE in self.ukma_data.get_key().scopes

    def run(self) -> SyncReport:
        current = current_academic_year_start()
        report = SyncReport(years=[current - 1, current])
        for year in report.years:
            after = 0
            while True:
                page = self.ukma_data.list_offering_instructors(
                    UkmaDataPageParams(after=after, limit=UKMA_DATA_MAX_PAGE_SIZE), year=year
                )
                with transaction.atomic():
                    self._apply_page(page.items, report)
                after = page.cursor
                if not page.has_more:
                    break
        return report

    def _apply_page(self, rows: list[UkmaDataOfferingInstructors], report: SyncReport) -> None:
        offerings = CourseOffering.objects.in_bulk(
            [row.saz_code for row in rows], field_name="code"
        )
        for row in rows:
            offering = offerings.get(row.saz_code)
            if offering is None:
                report.skipped += 1
                continue
            report.matched += 1
            listed = [] if row.removed_at is not None else row.instructors
            wanted = self._wanted_links(listed, report)
            current = {
                (link.instructor_id, link.role): link.id
                for link in CourseInstructor.objects.filter(course_offering=offering)
            }
            stale = [link_id for key, link_id in current.items() if key not in wanted]
            if stale:
                CourseInstructor.objects.filter(id__in=stale).delete()
                report.removed += len(stale)
            new = [
                CourseInstructor(instructor_id=instructor_id, course_offering=offering, role=role)
                for instructor_id, role in wanted
                if (instructor_id, role) not in current
            ]
            CourseInstructor.objects.bulk_create(new)
            report.linked += len(new)

    def _wanted_links(
        self, listed: list[UkmaDataOfferingInstructor], report: SyncReport
    ) -> set[tuple[object, str]]:
        wanted: set[tuple[object, str]] = set()
        for teacher in listed:
            email = (teacher.email or "").strip().lower()
            if not email:
                report.no_email += 1
                continue
            instructor = Instructor.objects.filter(email__iexact=email).first()
            if instructor is None:
                # get_or_create, not create: the CSV import writes the same
                # table without this job's lock.
                instructor, created = Instructor.objects.get_or_create(
                    email=email,
                    defaults={
                        "last_name": teacher.last_name,
                        "first_name": teacher.first_name,
                        "patronymic": teacher.middle_name or "",
                    },
                )
                report.created += int(created)
            for role in ROLES[teacher.role]:
                wanted.add((instructor.id, role.value))
        return wanted
