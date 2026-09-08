from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from rating_app.models import CourseOfferingSpeciality, Speciality
from rating_app.models.choices import SemesterTerm


def get_current_academic_year_start(now=None) -> int:
    now = now or timezone.now()
    return now.year if now.month >= 9 else now.year - 1


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
        candidate_ids = list(self._find_candidates().values_list("id", flat=True))
        link_count = CourseOfferingSpeciality.objects.filter(
            speciality_id__in=candidate_ids
        ).count()

        if not apply:
            self.stdout.write(
                f"Would delete {len(candidate_ids)} specialities ({link_count} offering links)."
            )
            for spec_id in candidate_ids:
                self.stdout.write(f"  {spec_id}")
            self.stdout.write(self.style.WARNING("Dry run — no changes made."))
            return

        with transaction.atomic():
            deleted_links, _ = CourseOfferingSpeciality.objects.filter(
                speciality_id__in=candidate_ids
            ).delete()
            deleted_specs, _ = Speciality.objects.filter(id__in=candidate_ids).delete()

        self.stdout.write(
            self.style.SUCCESS(
                f"Deleted {deleted_specs} specialities ({deleted_links} offering links)."
            )
        )

    def _find_candidates(self):
        recent_spec_ids = CourseOfferingSpeciality.objects.filter(recent_offering_q()).values(
            "speciality_id"
        )
        return Speciality.objects.filter(students__isnull=True).exclude(pk__in=recent_spec_ids)
