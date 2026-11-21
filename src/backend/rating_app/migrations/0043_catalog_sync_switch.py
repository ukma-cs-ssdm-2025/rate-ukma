from django.db import migrations

SWITCH_NAME = "catalog_sync_proposals"


def create_switch(apps, schema_editor):
    switch = apps.get_model("waffle", "Switch")
    switch.objects.get_or_create(name=SWITCH_NAME, defaults={"active": False})


def delete_switch(apps, schema_editor):
    switch = apps.get_model("waffle", "Switch")
    switch.objects.filter(name=SWITCH_NAME).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("rating_app", "0042_catalogsynccursor_course_ukma_data_id_and_more"),
        ("waffle", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(create_switch, delete_switch),
    ]
