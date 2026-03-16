from django.core.management.base import BaseCommand
from django.db import transaction

from rating_app.models import Department, Faculty, Speciality


class Command(BaseCommand):
    help = (
        "Merge duplicate faculties that differ only in conjunction "
        '("та" vs "і"). Reassigns departments and specialities to '
        "the canonical faculty, then deletes the duplicate."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would be done without making changes.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        duplicates = Faculty.objects.filter(name__contains=" та ")

        if not duplicates.exists():
            self.stdout.write(self.style.SUCCESS("No duplicate faculties found."))
            return

        for dup in duplicates:
            canonical_name = dup.name.replace(" та ", " і ")
            canonical = Faculty.objects.filter(name=canonical_name).first()

            if canonical is None:
                self.stdout.write(f'  Rename: "{dup.name}" -> "{canonical_name}"')
                if not dry_run:
                    dup.name = canonical_name
                    dup.save(update_fields=["name"])
                continue

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
