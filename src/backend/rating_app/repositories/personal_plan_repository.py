import uuid

from django.db.models import Prefetch, QuerySet

from rating_app.application_schemas.personal_plan import (
    PlanCoursePutParams,
    PlanCourseSource,
    PlannedCourseEntry,
    TakenCourse,
)
from rating_app.models import Course, CourseOffering, Enrollment, PlannedCourse
from rating_app.models.choices import PlanSlot, SemesterTerm
from rating_app.repositories.to_domain_mappers import PlanCourseSourceMapper, PlanOfferingMapper


class PersonalPlanRepository:
    def __init__(
        self,
        course_mapper: PlanCourseSourceMapper,
        offering_mapper: PlanOfferingMapper,
    ) -> None:
        self._course_mapper = course_mapper
        self._offering_mapper = offering_mapper

    def get_taken_courses(self, student_id: uuid.UUID) -> list[TakenCourse]:
        enrollments = (
            Enrollment.objects.filter(
                student_id=student_id, status__in=Enrollment.ATTENDED_STATUSES
            )
            .select_related(
                "offering__semester",
                "offering__course__department__faculty",
            )
            .prefetch_related(
                "offering__terms__semester",
                "offering__course_offering_specialities",
            )
            .order_by("offering__semester__year", "offering__course__title")
        )
        return [
            TakenCourse(
                course=self._course_mapper.process(enrollment.offering.course, []),
                offering=self._offering_mapper.process(enrollment.offering),
            )
            for enrollment in enrollments
        ]

    def get_planned_courses(self, student_id: uuid.UUID) -> list[PlannedCourseEntry]:
        # Meta.ordering set to "updated_at": the latest move goes last in its slot.
        planned = (
            PlannedCourse.objects.filter(student_id=student_id)
            .select_related("course__department__faculty")
            .prefetch_related(
                Prefetch(
                    "course__offerings",
                    queryset=self._build_offerings_queryset(),
                    to_attr="plan_offerings",
                )
            )
        )
        return [
            PlannedCourseEntry(
                course=self._course_mapper.process(
                    row.course, getattr(row.course, "plan_offerings", [])
                ),
                study_year=row.study_year,
                term=SemesterTerm(row.term),
                slot=PlanSlot(row.slot),
            )
            for row in planned
        ]

    def get_course_source(self, course_id: uuid.UUID) -> PlanCourseSource | None:
        course = (
            Course.objects.filter(id=course_id)
            .select_related("department__faculty")
            .prefetch_related(
                Prefetch(
                    "offerings", queryset=self._build_offerings_queryset(), to_attr="plan_offerings"
                )
            )
            .first()
        )
        if course is None:
            return None
        return self._course_mapper.process(course, getattr(course, "plan_offerings", []))

    def place(self, student_id: uuid.UUID, params: PlanCoursePutParams) -> None:
        PlannedCourse.objects.update_or_create(
            student_id=student_id,
            course_id=params.course_id,
            defaults={
                "study_year": params.study_year,
                "term": params.term,
                "slot": params.slot,
            },
        )

    def remove(self, student_id: uuid.UUID, course_id: uuid.UUID) -> bool:
        deleted, _ = PlannedCourse.objects.filter(
            student_id=student_id, course_id=course_id
        ).delete()
        return deleted > 0

    def _build_offerings_queryset(self) -> QuerySet[CourseOffering]:
        return CourseOffering.objects.select_related("semester").prefetch_related(
            "terms__semester", "course_offering_specialities"
        )
