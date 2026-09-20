from collections import Counter

from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from rating_app.models import (
    CourseOffering,
    CourseOfferingSpeciality,
    Speciality,
    Student,
)
from rating_app.models.choices import SemesterTerm


def get_current_academic_year_start(now=None) -> int:
    now = now or timezone.now()
    return now.year if now.month >= 9 else now.year - 1


def academic_year_label(start: int) -> str:
    return f"{start}–{start + 1}"


def recent_offering_q() -> Q:
    current_start = get_current_academic_year_start()
    return (
        Q(offering__semester__year=current_start, offering__semester__term=SemesterTerm.FALL)
        | Q(
            offering__semester__year=current_start + 1,
            offering__semester__term__in=[SemesterTerm.SPRING, SemesterTerm.SUMMER],
        )
        | Q(
            offering__semester__year=current_start - 1,
            offering__semester__term=SemesterTerm.FALL,
        )
        | Q(
            offering__semester__year=current_start,
            offering__semester__term__in=[SemesterTerm.SPRING, SemesterTerm.SUMMER],
        )
    )


def find_legacy_speciality_ids() -> list:
    recent_spec_ids = CourseOfferingSpeciality.objects.filter(recent_offering_q()).values(
        "speciality_id"
    )
    return list(
        Speciality.objects.filter(students__isnull=True)
        .exclude(pk__in=recent_spec_ids)
        .values_list("id", flat=True)
    )


def collect_report() -> dict:
    current_start = get_current_academic_year_start()
    previous_start = current_start - 1
    scanned = Speciality.objects.count()
    students = Student.objects.count()
    links = CourseOfferingSpeciality.objects.count()

    year_counts: Counter[int] = Counter()
    for year, term in CourseOffering.objects.values_list("semester__year", "semester__term"):
        if year is None or not term:
            continue
        start = year if term == SemesterTerm.FALL else year - 1
        year_counts[start] += 1

    return {
        "scanned": scanned,
        "students": students,
        "links": links,
        "current_start": current_start,
        "previous_start": previous_start,
        "offerings_current": year_counts.get(current_start, 0),
        "offerings_previous": year_counts.get(previous_start, 0),
        "offerings_older": sum(
            count
            for start, count in year_counts.items()
            if start not in (current_start, previous_start)
        ),
    }


def run_prune(*, apply: bool) -> dict:
    candidate_ids = find_legacy_speciality_ids()
    candidate_links = CourseOfferingSpeciality.objects.filter(
        speciality_id__in=candidate_ids
    ).count()

    if not apply:
        return {
            "deleted_specs": 0,
            "deleted_links": 0,
            "candidate_specs": len(candidate_ids),
            "candidate_links": candidate_links,
            "candidate_ids": candidate_ids,
        }

    with transaction.atomic():
        deleted_links, _ = CourseOfferingSpeciality.objects.filter(
            speciality_id__in=candidate_ids
        ).delete()
        deleted_specs, _ = Speciality.objects.filter(id__in=candidate_ids).delete()

    return {
        "deleted_specs": deleted_specs,
        "deleted_links": deleted_links,
        "candidate_specs": len(candidate_ids),
        "candidate_links": candidate_links,
        "candidate_ids": candidate_ids,
    }


class Command(BaseCommand):
    help = (
        "Delete legacy specialities with 0 students and no recent offerings (dry-run by default)."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--apply",
            action="store_true",
            help="Actually delete. Without it, only show what would be deleted.",
        )

    def handle(self, *args, **options):
        apply = options["apply"]
        report = collect_report()
        result = run_prune(apply=apply)

        self.stdout.write(
            f"Scanned {report['scanned']} specialities "
            f"({report['students']} students, {report['links']} offering links)."
        )
        self.stdout.write(
            f"Current academic year: {academic_year_label(report['current_start'])}; "
            f"previous: {academic_year_label(report['previous_start'])}."
        )
        self.stdout.write(
            f"Offerings by academic year: current {report['offerings_current']}, "
            f"previous {report['offerings_previous']}, older {report['offerings_older']}."
        )

        if not apply:
            self.stdout.write(
                f"Would delete {result['candidate_specs']} specialities "
                f"({result['candidate_links']} offering links)."
            )
            for spec_id in result["candidate_ids"]:
                self.stdout.write(f"  {spec_id}")
            self.stdout.write(self.style.WARNING("Dry run — no changes made."))
            return

        self.stdout.write(
            self.style.SUCCESS(
                f"Deleted {result['deleted_specs']} specialities "
                f"({result['deleted_links']} offering links)."
            )
        )
