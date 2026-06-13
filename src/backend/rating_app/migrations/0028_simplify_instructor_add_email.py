"""Simplify Instructor: drop academic_degree/academic_title, add unique email.

Deploy order on populated environments:
    1. Run `manage.py shell -c "from rating_app.models import Instructor; Instructor.objects.all().delete()"`
       (or apply this migration on an empty Instructor table).
    2. Apply this migration.
    3. Run `manage.py ingest_instructors_from_csv <path> --purge` to repopulate
       from the Microsoft 365 export.

The `email` column is `unique=True` with no default, so the table must be empty
when this migration runs.
"""

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("rating_app", "0027_comment_alter_notification_event_type_and_more"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="instructor",
            name="academic_degree",
        ),
        migrations.RemoveField(
            model_name="instructor",
            name="academic_title",
        ),
        migrations.AddField(
            model_name="instructor",
            name="email",
            field=models.EmailField(db_index=True, max_length=254, unique=True),
        ),
    ]
