from django.contrib.postgres.operations import TrigramExtension
from django.db import migrations

from django.contrib.postgres.indexes import GinIndex


class Migration(migrations.Migration):

    dependencies = [
        ("rating_app", "0019_perf_rating_created_at_idx_remove_co_ordering"),
    ]

    operations = [
        TrigramExtension(),
        migrations.AddIndex(
            model_name="course",
            index=GinIndex(
                name="course_title_trgm_idx",
                fields=["title"],
                opclasses=["gin_trgm_ops"],
            ),
        ),
    ]
