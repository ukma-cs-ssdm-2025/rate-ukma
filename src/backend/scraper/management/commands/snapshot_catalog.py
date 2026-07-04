import json
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand

import structlog

from rating_app.models import (
    Course,
    CourseOffering,
    CourseOfferingTerm,
    Department,
    Enrollment,
    Faculty,
    Semester,
    Speciality,
    Student,
)
from rating_app.models.course_offering_speciality import CourseOfferingSpeciality

logger = structlog.get_logger(__name__)


def _student_key(
    email: str,
    first_name: str,
    last_name: str,
    patronymic: str,
    education_level: str,
    speciality: str | None,
) -> str:
    if email:
        return email.lower()
    return f"{last_name}|{first_name}|{patronymic}|{education_level}|{speciality or ''}"


def _collect_keyed(rows, build_key, build_value, section: str) -> dict:
    result = {}
    collisions = 0
    for row in rows:
        key = build_key(row)
        if key in result:
            collisions += 1
        result[key] = build_value(row)
    if collisions:
        logger.warning("snapshot_key_collisions", section=section, collisions=collisions)
    return result


def _snapshot_faculties() -> dict:
    return {name: {} for name in Faculty.objects.values_list("name", flat=True)}


def _snapshot_departments() -> dict:
    rows = Department.objects.values("name", "faculty__name")
    return {f"{r['faculty__name']}|{r['name']}": {} for r in rows}


def _snapshot_specialities() -> dict:
    rows = Speciality.objects.values("name", "faculty__name")
    return {r["name"]: {"faculty": r["faculty__name"]} for r in rows}


def _snapshot_semesters() -> dict:
    rows = Semester.objects.values("year", "term")
    return {f"{r['year']}-{r['term']}": {} for r in rows}


def _snapshot_courses() -> dict:
    rows = Course.objects.values(
        "title",
        "education_level",
        "status",
        "description",
        "department__name",
        "department__faculty__name",
    )
    return {
        f"{r['title']}|{r['department__name']}|{r['education_level']}": {
            "faculty": r["department__faculty__name"],
            "status": r["status"],
            "description": r["description"],
        }
        for r in rows
    }


def _snapshot_offerings() -> dict:
    rows = CourseOffering.objects.values(
        "code",
        "course__title",
        "course__department__name",
        "course__education_level",
        "semester__year",
        "semester__term",
        "credits",
        "weekly_hours",
        "study_year",
        "lecture_count",
        "practice_count",
        "practice_type",
        "exam_type",
        "max_students",
        "max_groups",
        "group_size_min",
        "group_size_max",
    )
    return {
        r["code"]: {
            "course": (
                f"{r['course__title']}|{r['course__department__name']}"
                f"|{r['course__education_level']}"
            ),
            "semester": f"{r['semester__year']}-{r['semester__term']}",
            "credits": str(r["credits"]),
            "weekly_hours": r["weekly_hours"],
            "study_year": r["study_year"],
            "lecture_count": r["lecture_count"],
            "practice_count": r["practice_count"],
            "practice_type": r["practice_type"],
            "exam_type": r["exam_type"],
            "max_students": r["max_students"],
            "max_groups": r["max_groups"],
            "group_size_min": r["group_size_min"],
            "group_size_max": r["group_size_max"],
        }
        for r in rows.iterator()
    }


def _snapshot_offering_terms() -> dict:
    rows = CourseOfferingTerm.objects.values(
        "offering__code",
        "semester__year",
        "semester__term",
        "credits",
        "weekly_hours",
        "exam_type",
        "lecture_count",
        "practice_count",
        "practice_type",
    )
    return {
        f"{r['offering__code']}|{r['semester__year']}-{r['semester__term']}": {
            "credits": str(r["credits"]),
            "weekly_hours": r["weekly_hours"],
            "exam_type": r["exam_type"],
            "lecture_count": r["lecture_count"],
            "practice_count": r["practice_count"],
            "practice_type": r["practice_type"],
        }
        for r in rows.iterator()
    }


def _snapshot_offering_specialities() -> dict:
    rows = CourseOfferingSpeciality.objects.values(
        "offering__code", "speciality__name", "type_kind"
    )
    return {
        f"{r['offering__code']}|{r['speciality__name']}": {"type_kind": r["type_kind"]}
        for r in rows.iterator()
    }


def _snapshot_students() -> dict:
    rows = Student.objects.values(
        "email",
        "first_name",
        "last_name",
        "patronymic",
        "education_level",
        "speciality__name",
        "program_start_academic_year_start",
    )
    return _collect_keyed(
        rows.iterator(),
        lambda r: _student_key(
            r["email"],
            r["first_name"],
            r["last_name"],
            r["patronymic"],
            r["education_level"],
            r["speciality__name"],
        ),
        lambda r: {
            "name": f"{r['last_name']} {r['first_name']} {r['patronymic']}".strip(),
            "education_level": r["education_level"],
            "speciality": r["speciality__name"],
            "program_start": r["program_start_academic_year_start"],
        },
        section="students",
    )


def _snapshot_enrollments() -> dict:
    rows = Enrollment.objects.values(
        "offering__code",
        "status",
        "student__email",
        "student__first_name",
        "student__last_name",
        "student__patronymic",
        "student__education_level",
        "student__speciality__name",
    )
    return _collect_keyed(
        rows.iterator(),
        lambda r: "{}|{}".format(
            r["offering__code"],
            _student_key(
                r["student__email"],
                r["student__first_name"],
                r["student__last_name"],
                r["student__patronymic"],
                r["student__education_level"],
                r["student__speciality__name"],
            ),
        ),
        lambda r: {"status": r["status"]},
        section="enrollments",
    )


SECTION_SNAPSHOTTERS = {
    "faculties": _snapshot_faculties,
    "departments": _snapshot_departments,
    "specialities": _snapshot_specialities,
    "semesters": _snapshot_semesters,
    "courses": _snapshot_courses,
    "offerings": _snapshot_offerings,
    "offering_terms": _snapshot_offering_terms,
    "offering_specialities": _snapshot_offering_specialities,
    "students": _snapshot_students,
    "enrollments": _snapshot_enrollments,
}


class Command(BaseCommand):
    help = "Snapshot catalog tables into a JSON file keyed by natural keys (for ingestion diff)"

    def add_arguments(self, parser):
        parser.add_argument(
            "--out",
            type=str,
            default=str(settings.SCRAPER_STATE_DIR / "catalog_snapshot.json"),
            help="Output JSON file",
        )

    def handle(self, *args, **options):
        out_path = Path(options["out"])
        out_path.parent.mkdir(parents=True, exist_ok=True)

        snapshot = {}
        for section, snapshotter in SECTION_SNAPSHOTTERS.items():
            snapshot[section] = snapshotter()
            logger.info("section_snapshotted", section=section, records=len(snapshot[section]))

        with out_path.open("w", encoding="utf-8") as file:
            json.dump(snapshot, file, ensure_ascii=False)

        logger.info("catalog_snapshot_saved", path=str(out_path))
