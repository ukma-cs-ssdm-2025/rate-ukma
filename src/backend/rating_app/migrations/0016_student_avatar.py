from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("rating_app", "0015_remove_course_specialities_delete_coursespeciality"),
    ]

    operations = [
        migrations.AddField(
            model_name="student",
            name="avatar",
            field=models.ImageField(blank=True, null=True, upload_to="avatars/"),
        ),
    ]
