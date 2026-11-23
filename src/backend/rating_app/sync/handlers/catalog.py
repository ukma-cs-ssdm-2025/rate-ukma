"""Catalog change handlers: the link, new, change and removed kinds.

A catalog apply is set-based: every handler here also writes its kind's ready
changes in one or a few statements, so the first ``link`` group (~29k rows) is
not 29k saves. ``removed_*`` writes nothing to the catalog: the apply's
``applied`` state is the acknowledgement that a person saw it (D7).
"""

from __future__ import annotations

import uuid
from collections.abc import Callable
from decimal import Decimal

from django.db import connection, models

from rating_app.models import (
    Course,
    CourseOffering,
    CourseOfferingSpeciality,
    CourseOfferingTerm,
    Department,
    Faculty,
    Semester,
    Speciality,
    SyncChange,
)
from rating_app.sync.handlers import MissingRowError, register
from rating_app.sync.payloads import (
    ChangeCoursePayload,
    ChangeOfferingPayload,
    LinkCoursePayload,
    NamePayload,
    NewCoursePayload,
    NewDepartmentPayload,
    NewOfferingPayload,
    OfferingPayload,
    UkmaDataIdPayload,
)


def _uuid(value: str | None) -> uuid.UUID | None:
    if value is None:
        return None
    try:
        return uuid.UUID(value)
    except (TypeError, ValueError):
        return None


def _linked_exists(model: type[models.Model]) -> Callable[[str], bool]:
    def exists(key: str) -> bool:
        pk = _uuid(key)
        return pk is not None and model.objects.filter(pk=pk, ukma_data_id__isnull=False).exists()

    return exists


def _created_exists(model: type[models.Model]) -> Callable[[str], bool]:
    def exists(key: str) -> bool:
        return model.objects.filter(ukma_data_id=key).exists()

    return exists


class _Semesters:
    """One get_or_create per (year, term) a batch mentions."""

    def __init__(self) -> None:
        self._semesters: dict[tuple[int, str], Semester] = {}

    def get(self, year: int, term: str) -> Semester:
        key = (year, term)
        if key not in self._semesters:
            semester, _ = Semester.objects.get_or_create(year=year, term=term)
            self._semesters[key] = semester
        return self._semesters[key]

    def id_for(self, year: int, term: str) -> uuid.UUID:
        return self.get(year, term).id


# Links


_LINK_BATCH_SIZE = 1000


def _set_ukma_data_ids(
    model: type[models.Model],
    changes: list[SyncChange],
    payload_type: type[UkmaDataIdPayload] = UkmaDataIdPayload,
) -> None:
    """Link a batch with ``UPDATE ... FROM (VALUES ...)``.

    One statement per :data:`_LINK_BATCH_SIZE` rows: a ``bulk_update`` becomes
    one ``CASE WHEN`` with a branch per row, which is minutes on the first
    ~29k-row ``link`` group.
    """
    rows = []
    for change in changes:
        payload = payload_type.model_validate(change.after)
        pk = _uuid(change.target_id)
        if pk is None:
            continue
        rows.append((pk, payload.ukma_data_id))
    table = connection.ops.quote_name(model._meta.db_table)
    pk_field = model._meta.pk
    id_column = connection.ops.quote_name(pk_field.attname if pk_field is not None else "id")
    value_column = connection.ops.quote_name("ukma_data_id")
    for start in range(0, len(rows), _LINK_BATCH_SIZE):
        _set_ukma_data_ids_batch(
            table, id_column, value_column, rows[start : start + _LINK_BATCH_SIZE]
        )


def _set_ukma_data_ids_batch(
    table: str,
    id_column: str,
    value_column: str,
    rows: list[tuple[uuid.UUID, str]],
) -> None:
    if not rows:
        return
    if connection.vendor == "sqlite":
        # SQLite names a VALUES row column1, column2 and stores a UUIDField as hex.
        placeholders = ", ".join(["(%s, %s)"] * len(rows))
        sql = (
            f"UPDATE {table} AS t SET {value_column} = v.column2 "
            f"FROM (VALUES {placeholders}) AS v WHERE t.{id_column} = v.column1"
        )
        params = [value for pk, ukma_data_id in rows for value in (pk.hex, ukma_data_id)]
    else:
        placeholders = ", ".join(["(%s::uuid, %s)"] * len(rows))
        sql = (
            f"UPDATE {table} AS t SET {value_column} = v.ud "
            f"FROM (VALUES {placeholders}) AS v(id, ud) WHERE t.{id_column} = v.id"
        )
        params = [value for pk, ukma_data_id in rows for value in (str(pk), ukma_data_id)]
    with connection.cursor() as cursor:
        cursor.execute(sql, params)


def _apply_link_faculties(changes: list[SyncChange]) -> None:
    _set_ukma_data_ids(Faculty, changes)


@register("link_faculty", exists=_linked_exists(Faculty), apply_many=_apply_link_faculties)
def apply_link_faculty(change: SyncChange) -> None:
    _set_ukma_data_ids(Faculty, [change])


def _apply_link_departments(changes: list[SyncChange]) -> None:
    _set_ukma_data_ids(Department, changes)


@register("link_department", exists=_linked_exists(Department), apply_many=_apply_link_departments)
def apply_link_department(change: SyncChange) -> None:
    _set_ukma_data_ids(Department, [change])


def _apply_link_courses(changes: list[SyncChange]) -> None:
    _set_ukma_data_ids(Course, changes, LinkCoursePayload)


@register("link_course", exists=_linked_exists(Course), apply_many=_apply_link_courses)
def apply_link_course(change: SyncChange) -> None:
    _set_ukma_data_ids(Course, [change], LinkCoursePayload)


def _apply_link_offerings(changes: list[SyncChange]) -> None:
    _set_ukma_data_ids(CourseOffering, changes)


@register("link_offering", exists=_linked_exists(CourseOffering), apply_many=_apply_link_offerings)
def apply_link_offering(change: SyncChange) -> None:
    _set_ukma_data_ids(CourseOffering, [change])


# New rows


def _apply_new_faculties(changes: list[SyncChange]) -> None:
    rows = [
        Faculty(
            ukma_data_id=change.key,
            name=NamePayload.model_validate(change.after).name,
        )
        for change in changes
    ]
    Faculty.objects.bulk_create(rows, ignore_conflicts=True)


@register("new_faculty", exists=_created_exists(Faculty), apply_many=_apply_new_faculties)
def apply_new_faculty(change: SyncChange) -> None:
    _apply_new_faculties([change])


def _apply_new_departments(changes: list[SyncChange]) -> None:
    payloads = [(change, NewDepartmentPayload.model_validate(change.after)) for change in changes]
    faculty_by_ud = dict(
        Faculty.objects.filter(
            ukma_data_id__in={payload.faculty_ukma_id for _, payload in payloads}
        ).values_list("ukma_data_id", "id")
    )
    rows = []
    for change, payload in payloads:
        faculty_id = faculty_by_ud.get(payload.faculty_ukma_id)
        if faculty_id is None:
            raise MissingRowError(change, "faculty_missing")
        rows.append(Department(ukma_data_id=change.key, name=payload.name, faculty_id=faculty_id))
    Department.objects.bulk_create(rows, ignore_conflicts=True)


@register("new_department", exists=_created_exists(Department), apply_many=_apply_new_departments)
def apply_new_department(change: SyncChange) -> None:
    _apply_new_departments([change])


def _apply_new_courses(changes: list[SyncChange]) -> None:
    payloads = [(change, NewCoursePayload.model_validate(change.after)) for change in changes]
    department_by_ud = dict(
        Department.objects.filter(
            ukma_data_id__in={payload.department_ukma_id for _, payload in payloads}
        ).values_list("ukma_data_id", "id")
    )
    rows = []
    for change, payload in payloads:
        department_id = department_by_ud.get(payload.department_ukma_id)
        if department_id is None:
            raise MissingRowError(change, "department_missing")
        rows.append(
            Course(
                ukma_data_id=change.key,
                title=payload.title,
                education_level=payload.level,
                status=payload.status,
                description=payload.description,
                department_id=department_id,
            )
        )
    Course.objects.bulk_create(rows)


@register("new_course", exists=_created_exists(Course), apply_many=_apply_new_courses)
def apply_new_course(change: SyncChange) -> None:
    _apply_new_courses([change])


def _apply_new_offerings(changes: list[SyncChange]) -> None:
    payloads = [(change, NewOfferingPayload.model_validate(change.after)) for change in changes]
    course_ids = {
        uuid.UUID(payload.course_id) for _, payload in payloads if payload.course_id is not None
    }
    course_by_id = set(Course.objects.filter(id__in=course_ids).values_list("id", flat=True))
    course_by_ud: dict[str, uuid.UUID] = {}
    for ud_id, course_id in (
        Course.objects.filter(
            ukma_data_id__in={
                payload.course_ukma_id
                for _, payload in payloads
                if payload.course_ukma_id is not None
            }
        )
        .order_by("id")
        .values_list("ukma_data_id", "id")
    ):
        course_by_ud.setdefault(ud_id, course_id)
    speciality_by_name = dict(
        Speciality.objects.filter(
            name__in={
                speciality.name for _, payload in payloads for speciality in payload.specialities
            }
        ).values_list("name", "id")
    )
    semesters = _Semesters()

    offerings: list[CourseOffering] = []
    terms: list[CourseOfferingTerm] = []
    specialities: list[CourseOfferingSpeciality] = []
    for change, payload in payloads:
        course_id = (
            uuid.UUID(payload.course_id)
            if payload.course_id is not None and uuid.UUID(payload.course_id) in course_by_id
            else course_by_ud.get(payload.course_ukma_id or "")
        )
        if course_id is None:
            raise MissingRowError(change, "course_missing")
        offering = _offering_row(change, payload, course_id, semesters)
        offerings.append(offering)
        terms.extend(_term_rows(offering.id, payload.terms, semesters))
        specialities.extend(
            _speciality_rows(change, offering.id, payload.specialities, speciality_by_name)
        )
    CourseOffering.objects.bulk_create(offerings)
    CourseOfferingTerm.objects.bulk_create(terms, ignore_conflicts=True)
    CourseOfferingSpeciality.objects.bulk_create(specialities, ignore_conflicts=True)


def _offering_row(
    change: SyncChange,
    payload: OfferingPayload,
    course_id: uuid.UUID,
    semesters: _Semesters,
) -> CourseOffering:
    return CourseOffering(
        id=uuid.uuid4(),
        ukma_data_id=change.key,
        code=payload.saz_code,
        course_id=course_id,
        semester_id=semesters.id_for(payload.semester.year, payload.semester.term),
        exam_type=payload.exam_type,
        study_year=payload.study_year,
        max_students=payload.max_students,
        max_groups=payload.max_groups,
        group_size_min=payload.group_size_min,
        group_size_max=payload.group_size_max,
    )


def create_offering(change: SyncChange, payload: OfferingPayload, course_id: uuid.UUID) -> None:
    """Write one offering, its terms and specialities; shared with ``place_offering``."""
    semesters = _Semesters()
    speciality_by_name = dict(
        Speciality.objects.filter(
            name__in={speciality.name for speciality in payload.specialities}
        ).values_list("name", "id")
    )
    offering = _offering_row(change, payload, course_id, semesters)
    CourseOffering.objects.bulk_create([offering])
    CourseOfferingTerm.objects.bulk_create(
        _term_rows(offering.id, payload.terms, semesters), ignore_conflicts=True
    )
    CourseOfferingSpeciality.objects.bulk_create(
        _speciality_rows(change, offering.id, payload.specialities, speciality_by_name),
        ignore_conflicts=True,
    )


@register("new_offering", exists=_created_exists(CourseOffering), apply_many=_apply_new_offerings)
def apply_new_offering(change: SyncChange) -> None:
    _apply_new_offerings([change])


# Changes


def _apply_change_faculties(changes: list[SyncChange]) -> None:
    rows = []
    for change in changes:
        pk = _uuid(change.target_id)
        if pk is None:
            continue
        rows.append(Faculty(id=pk, name=NamePayload.model_validate(change.after).name))
    if rows:
        Faculty.objects.bulk_update(rows, ["name"])


@register("change_faculty", apply_many=_apply_change_faculties)
def apply_change_faculty(change: SyncChange) -> None:
    _apply_change_faculties([change])


def _apply_change_departments(changes: list[SyncChange]) -> None:
    rows = []
    for change in changes:
        pk = _uuid(change.target_id)
        if pk is None:
            continue
        rows.append(Department(id=pk, name=NamePayload.model_validate(change.after).name))
    if rows:
        Department.objects.bulk_update(rows, ["name"])


@register("change_department", apply_many=_apply_change_departments)
def apply_change_department(change: SyncChange) -> None:
    _apply_change_departments([change])


def _apply_change_courses(changes: list[SyncChange]) -> None:
    payloads = [(change, ChangeCoursePayload.model_validate(change.after)) for change in changes]
    department_by_ud = dict(
        Department.objects.filter(
            ukma_data_id__in={
                payload.department.ukma_data_id
                for _, payload in payloads
                if payload.department is not None and payload.department.ukma_data_id
            }
        ).values_list("ukma_data_id", "id")
    )
    ids = [pk for change in changes if (pk := _uuid(change.target_id)) is not None]
    courses = {course.id: course for course in Course.objects.filter(id__in=ids)}
    updated: set[str] = set()
    for change, payload in payloads:
        pk = _uuid(change.target_id)
        course = courses.get(pk) if pk is not None else None
        if course is None:
            continue
        fields = payload.model_fields_set
        if "title" in fields and payload.title is not None:
            course.title = payload.title
            updated.add("title")
        if "department" in fields and payload.department is not None:
            department_id = _uuid(payload.department.id) or department_by_ud.get(
                payload.department.ukma_data_id
            )
            if department_id is None:
                raise MissingRowError(change, "department_missing")
            course.department_id = department_id
            updated.add("department")
        if "education_level" in fields and payload.education_level is not None:
            course.education_level = payload.education_level
            updated.add("education_level")
        if "status" in fields and payload.status is not None:
            course.status = payload.status
            updated.add("status")
        if "description" in fields and payload.description is not None:
            course.description = payload.description
            updated.add("description")
    if courses and updated:
        Course.objects.bulk_update(list(courses.values()), sorted(updated))


@register("change_course", apply_many=_apply_change_courses)
def apply_change_course(change: SyncChange) -> None:
    _apply_change_courses([change])


_OFFERING_SCALARS = (
    "exam_type",
    "study_year",
    "max_students",
    "max_groups",
    "group_size_min",
    "group_size_max",
)


def _apply_change_offerings(changes: list[SyncChange]) -> None:
    payloads = [(change, ChangeOfferingPayload.model_validate(change.after)) for change in changes]
    ids = [pk for change in changes if (pk := _uuid(change.target_id)) is not None]
    offerings = {offering.id: offering for offering in CourseOffering.objects.filter(id__in=ids)}
    speciality_by_name = dict(
        Speciality.objects.filter(
            name__in={
                speciality.name
                for _, payload in payloads
                for speciality in payload.specialities_added or []
            }
        ).values_list("name", "id")
    )
    semesters = _Semesters()
    updated: set[str] = set()
    replaced_terms: list[CourseOffering] = []
    term_rows: list[CourseOfferingTerm] = []
    added_specialities: list[CourseOfferingSpeciality] = []

    for change, payload in payloads:
        pk = _uuid(change.target_id)
        offering = offerings.get(pk) if pk is not None else None
        if offering is None:
            continue
        fields = payload.model_fields_set
        for name in _OFFERING_SCALARS:
            if name in fields:
                setattr(offering, name, getattr(payload, name))
                updated.add(name)
        if "semester" in fields and payload.semester is not None:
            offering.semester = semesters.get(payload.semester.year, payload.semester.term)
            updated.add("semester")
        if "terms" in fields and payload.terms is not None:
            replaced_terms.append(offering)
            term_rows.extend(_term_rows(offering.id, payload.terms, semesters))
        if "specialities_added" in fields and payload.specialities_added:
            added_specialities.extend(
                _speciality_rows(
                    change, offering.id, payload.specialities_added, speciality_by_name
                )
            )

    if offerings and updated:
        CourseOffering.objects.bulk_update(list(offerings.values()), sorted(updated))
    if replaced_terms:
        CourseOfferingTerm.objects.filter(
            offering_id__in=[offering.id for offering in replaced_terms]
        ).delete()
        CourseOfferingTerm.objects.bulk_create(term_rows, ignore_conflicts=True)
    if added_specialities:
        CourseOfferingSpeciality.objects.bulk_create(added_specialities, ignore_conflicts=True)


@register("change_offering", apply_many=_apply_change_offerings)
def apply_change_offering(change: SyncChange) -> None:
    _apply_change_offerings([change])


# Removals: acknowledged by the apply's state, never written to the catalog.


@register("removed_course")
def apply_removed_course(change: SyncChange) -> None:
    return None


@register("removed_offering")
def apply_removed_offering(change: SyncChange) -> None:
    return None


def _term_rows(
    offering_id: uuid.UUID, terms: list, semesters: _Semesters
) -> list[CourseOfferingTerm]:
    return [
        CourseOfferingTerm(
            offering_id=offering_id,
            semester_id=semesters.id_for(term.year, term.term),
            credits=Decimal(term.credits),
            weekly_hours=term.weekly_hours,
            lecture_count=term.lecture_count,
            practice_count=term.practice_count,
            practice_type=term.practice_type,
            exam_type=term.exam_type,
        )
        for term in terms
    ]


def _speciality_rows(
    change: SyncChange,
    offering_id: uuid.UUID,
    specialities: list,
    speciality_by_name: dict,
) -> list[CourseOfferingSpeciality]:
    rows = []
    for speciality in specialities:
        speciality_id = speciality_by_name.get(speciality.name)
        if speciality_id is None:
            raise MissingRowError(change, "speciality_missing")
        rows.append(
            CourseOfferingSpeciality(
                offering_id=offering_id,
                speciality_id=speciality_id,
                type_kind=speciality.kind,
            )
        )
    return rows
