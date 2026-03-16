"""
Merge duplicate faculties that differ only in conjunction ("та" vs "і").

The scraper historically stored some faculty names with "та" (e.g.
"Факультет соціальних наук і соціальних технологій" was stored as
"...наук та соціальних технологій"). The official names use "і".
This migration reassigns related departments and specialities from
the duplicate "та" faculty to the canonical "і" faculty, then deletes
the duplicate.
"""

from django.db import migrations


def merge_duplicate_faculties(apps, schema_editor):
    Faculty = apps.get_model("rating_app", "Faculty")
    Department = apps.get_model("rating_app", "Department")
    Speciality = apps.get_model("rating_app", "Speciality")

    duplicates = Faculty.objects.filter(name__contains=" та ")

    for dup in duplicates:
        canonical_name = dup.name.replace(" та ", " і ")
        canonical = Faculty.objects.filter(name=canonical_name).first()

        if canonical is None:
            # No canonical counterpart exists — just fix the name in place.
            dup.name = canonical_name
            dup.save(update_fields=["name"])
            continue

        # Reassign related objects to the canonical faculty.
        Department.objects.filter(faculty=dup).update(faculty=canonical)
        Speciality.objects.filter(faculty=dup).update(faculty=canonical)

        dup.delete()


def reverse_noop(apps, schema_editor):
    """Reversal is not feasible — the duplicate data cannot be reconstructed."""


class Migration(migrations.Migration):
    dependencies = [
        ("rating_app", "0020_course_title_trigram_idx"),
    ]

    operations = [
        migrations.RunPython(merge_duplicate_faculties, reverse_noop),
    ]
