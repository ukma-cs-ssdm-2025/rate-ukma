from django.db import migrations, models


class Migration(migrations.Migration):
    """Add Rating.instructors M2M; keep Rating.instructor text field as legacy backward-compat."""

    dependencies = [
        ('rating_app', '0028_simplify_instructor_add_email'),
    ]

    operations = [
        migrations.AddField(
            model_name='rating',
            name='instructors',
            field=models.ManyToManyField(blank=True, related_name='ratings', to='rating_app.instructor'),
        ),
        migrations.AlterField(
            model_name='rating',
            name='instructor',
            field=models.CharField(
                blank=True,
                default='',
                help_text=(
                    'Legacy free-text field. Kept for backward compatibility with old '
                    'clients; new clients should use the `instructors` M2M instead.'
                ),
                max_length=256,
            ),
        ),
    ]
