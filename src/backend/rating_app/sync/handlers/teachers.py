"""Teacher change handlers: exactly what ``sync_offering_instructors`` writes.

A ``teacher_created`` change's key is the teacher's lower-cased email, because
a link change's ``requires`` names that key. Emails are matched with
``iexact``, as today's sync does, and new rows are stored lower-cased.
"""

from __future__ import annotations

from rating_app.models import CourseInstructor, Instructor, SyncChange
from rating_app.sync.handlers import register
from rating_app.sync.payloads import (
    TeacherCreatedPayload,
    TeacherLinkAddedPayload,
    TeacherLinkRemovedPayload,
)


def teacher_exists(email: str) -> bool:
    return Instructor.objects.filter(email__iexact=email).exists()


@register("teacher_created", exists=teacher_exists)
def apply_teacher_created(change: SyncChange) -> None:
    payload = TeacherCreatedPayload.model_validate(change.after)
    email = payload.email.strip().lower()
    if teacher_exists(email):
        return
    Instructor.objects.get_or_create(
        email=email,
        defaults={
            "last_name": payload.last_name,
            "first_name": payload.first_name,
            "patronymic": payload.middle_name,
        },
    )


@register("teacher_link_added")
def apply_teacher_link_added(change: SyncChange) -> None:
    payload = TeacherLinkAddedPayload.model_validate(change.after)
    instructor = Instructor.objects.filter(email__iexact=payload.teacher_email).first()
    if instructor is None:
        raise LookupError("teacher_missing")
    CourseInstructor.objects.get_or_create(
        instructor=instructor,
        course_offering_id=change.target_id,
        role=payload.role,
    )


@register("teacher_link_removed")
def apply_teacher_link_removed(change: SyncChange) -> None:
    payload = TeacherLinkRemovedPayload.model_validate(change.after)
    CourseInstructor.objects.filter(
        course_offering_id=change.target_id,
        instructor_id=payload.instructor_id,
        role=payload.role,
    ).delete()
