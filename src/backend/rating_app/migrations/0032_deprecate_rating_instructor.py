from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("rating_app", "0031_merge_20260815_1422"),
    ]

    operations = [
        migrations.AlterField(
            model_name="rating",
            name="instructor",
            field=models.CharField(
                blank=True,
                default="",
                help_text="Deprecated. The text the student typed; use `instructors`.",
                max_length=256,
            ),
        ),
    ]
