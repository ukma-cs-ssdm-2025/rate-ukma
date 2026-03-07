from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("rating_app", "0017_courseofferingspeciality_speciality_type_idx"),
    ]

    operations = [
        migrations.AddIndex(
            model_name="ratingvote",
            index=models.Index(fields=["rating", "type"], name="rating_vote_rating_type_idx"),
        ),
    ]
