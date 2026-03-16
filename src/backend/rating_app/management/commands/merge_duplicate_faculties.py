# Temporary one-off script to fix a specific duplicate faculty record.
# Not intended as a reusable command — safe to remove after execution.

from django.core.management.base import BaseCommand
from django.db import transaction

from rating_app.models import Department, Faculty, Speciality


class Command(BaseCommand):
    help = (
        'Merge the duplicate "Факультет соціальних наук та соціальних технологій" '
        'into the canonical "...і..." variant.'
    )

    DUPLICATE_NAME = "Факультет соціальних наук та соціальних технологій"
    CANONICAL_NAME = "Факультет соціальних наук і соціальних технологій"

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would be done without making changes.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        dry_run = options["dry_run"]

        dup = Faculty.objects.filter(name=self.DUPLICATE_NAME).first()
        if dup is None:
            self.stdout.write(self.style.SUCCESS("No duplicate faculty found."))
            return

        canonical = Faculty.objects.filter(name=self.CANONICAL_NAME).first()

        if canonical is None:
            self.stdout.write(f'  Rename: "{dup.name}" -> "{self.CANONICAL_NAME}"')
            if not dry_run:
                dup.name = self.CANONICAL_NAME
                dup.save(update_fields=["name"])
        else:
            dept_count = Department.objects.filter(faculty=dup).count()
            spec_count = Speciality.objects.filter(faculty=dup).count()

            self.stdout.write(
                f'  Merge: "{dup.name}" -> "{canonical.name}" '
                f"({dept_count} departments, {spec_count} specialities)"
            )
            if not dry_run:
                Department.objects.filter(faculty=dup).update(faculty=canonical)
                Speciality.objects.filter(faculty=dup).update(faculty=canonical)
                dup.delete()

        if dry_run:
            self.stdout.write(self.style.WARNING("Dry run — no changes made."))
        else:
            self.stdout.write(self.style.SUCCESS("Done."))
