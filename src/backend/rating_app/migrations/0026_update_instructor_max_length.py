from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("rating_app", "0025_add_instructor_to_rating"),
    ]

    operations = [
        migrations.AlterField(
            model_name="rating",
            name="instructor",
            field=models.CharField(
                blank=True,
                default="",
                help_text="Temporary free-text field; will be replaced with a verified instructor FK.",
                max_length=256,
            ),
        ),
    ]
