import uuid

from django.db.models import Prefetch, QuerySet

from rating_app.application_schemas.personal_plan import (
    MandatoryCourse,
    PlanCoursePutParams,
    PlanCourseSource,
    PlannedCourseEntry,
    TakenCourse,
)
from rating_app.constants import ATTENDED_ENROLLMENT_STATUSES
from rating_app.models import Course, CourseOffering, Enrollment, PlannedCourse
from rating_app.models.choices import CourseTypeKind, EducationLevel, PlanSlot, SemesterTerm
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
                student_id=student_id, status__in=ATTENDED_ENROLLMENT_STATUSES
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

    def get_mandatory_courses(
        self, speciality_id: uuid.UUID, education_level: EducationLevel | None
    ) -> list[MandatoryCourse]:
        offerings = (
            self._build_offerings_queryset()
            .filter(
                course_offering_specialities__speciality_id=speciality_id,
                course_offering_specialities__type_kind=CourseTypeKind.COMPULSORY,
                terms__isnull=False,
            )
            .distinct()
        )
        if education_level:
            offerings = offerings.filter(course__education_level__in=[education_level, ""])
        return [
            MandatoryCourse(
                course=self._course_mapper.process(offering.course, []),
                offering=self._offering_mapper.process(offering),
                study_year=offering.study_year,
            )
            for offering in offerings.select_related("course__department__faculty")
            if offering.study_year is not None
        ]

    def get_planned_courses(self, student_id: uuid.UUID) -> list[PlannedCourseEntry]:
        planned = (
            PlannedCourse.objects.filter(student_id=student_id)
            .select_related("offering__semester", "offering__course__department__faculty")
            .prefetch_related("offering__terms__semester", "offering__course_offering_specialities")
        )
        return [
            PlannedCourseEntry(
                course=self._course_mapper.process(row.offering.course, []),
                offering=self._offering_mapper.process(row.offering),
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

    def place(
        self, student_id: uuid.UUID, params: PlanCoursePutParams, offering_id: uuid.UUID
    ) -> None:
        # A plan holds a course once, so a pick of another offering gives way to this one.
        PlannedCourse.objects.filter(
            student_id=student_id, offering__course_id=params.course_id
        ).exclude(offering_id=offering_id).delete()

        PlannedCourse.objects.update_or_create(
            student_id=student_id,
            offering_id=offering_id,
            defaults={
                "study_year": params.study_year,
                "term": params.semester_term,
                "slot": params.slot,
            },
        )

    def remove(self, student_id: uuid.UUID, course_id: uuid.UUID) -> bool:
        deleted, _ = PlannedCourse.objects.filter(
            student_id=student_id, offering__course_id=course_id
        ).delete()
        return deleted > 0

    def _build_offerings_queryset(self) -> QuerySet[CourseOffering]:
        return CourseOffering.objects.select_related("semester").prefetch_related(
            "terms__semester", "course_offering_specialities"
        )
