from django.db import migrations

# Mirrors SemesterService.MIDTERM_MONTH
CREATE_RATING_OPENS_ON = """
CREATE FUNCTION analytics.rating_opens_on(semester_year integer, semester_term text)
RETURNS date
LANGUAGE sql
IMMUTABLE STRICT
AS $$
    SELECT make_date(
        semester_year,
        CASE semester_term WHEN 'SPRING' THEN 3 WHEN 'SUMMER' THEN 6 WHEN 'FALL' THEN 11 END,
        1
    )
$$;
"""

CREATE_RATING_PERIOD_START = """
CREATE FUNCTION analytics.rating_period_start(day date)
RETURNS date
LANGUAGE sql
IMMUTABLE STRICT
AS $$
    SELECT max(opens_on)
    FROM (
        SELECT analytics.rating_opens_on(y, t) AS opens_on
        FROM unnest(ARRAY[extract(year FROM day)::int - 1, extract(year FROM day)::int]) AS y,
             unnest(ARRAY['SPRING', 'SUMMER', 'FALL']) AS t
    ) openings
    WHERE opens_on <= day
$$;
"""

CREATE_NEXT_RATING_PERIOD_START = """
CREATE FUNCTION analytics.next_rating_period_start(day date)
RETURNS date
LANGUAGE sql
IMMUTABLE STRICT
AS $$
    SELECT min(opens_on)
    FROM (
        SELECT analytics.rating_opens_on(y, t) AS opens_on
        FROM unnest(ARRAY[extract(year FROM day)::int, extract(year FROM day)::int + 1]) AS y,
             unnest(ARRAY['SPRING', 'SUMMER', 'FALL']) AS t
    ) openings
    WHERE opens_on > day
$$;
"""

# Mirrors CourseRepository._build_academic_year_q
CREATE_SEMESTER_ACADEMIC_YEAR = """
CREATE FUNCTION analytics.semester_academic_year(semester_year integer, semester_term text)
RETURNS integer
LANGUAGE sql
IMMUTABLE STRICT
AS $$
    SELECT CASE WHEN semester_term = 'FALL' THEN semester_year ELSE semester_year - 1 END
$$;
"""

# Mirrors SemesterService.get_current
CREATE_ACADEMIC_YEAR_ON = """
CREATE FUNCTION analytics.academic_year_on(day date)
RETURNS integer
LANGUAGE sql
IMMUTABLE STRICT
AS $$
    SELECT CASE
        WHEN extract(month FROM day) >= 9 THEN extract(year FROM day)::int
        ELSE extract(year FROM day)::int - 1
    END
$$;
"""

CREATE_TODAY = """
CREATE FUNCTION analytics.today()
RETURNS date
LANGUAGE sql
STABLE
AS $$
    SELECT (now() AT TIME ZONE 'UTC')::date
$$;
"""

CREATE_IS_EXCLUDED = """
CREATE FUNCTION analytics.is_excluded(user_id integer)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
    SELECT EXISTS (SELECT 1 FROM rating_app_excludedaccount x WHERE x.user_id = $1)
$$;
"""


class Migration(migrations.Migration):
    dependencies = [
        ("rating_app", "0046_excluded_account"),
    ]

    operations = [
        migrations.RunSQL(
            "CREATE SCHEMA analytics;",
            reverse_sql="DROP SCHEMA analytics;",
        ),
        migrations.RunSQL(
            CREATE_RATING_OPENS_ON,
            reverse_sql="DROP FUNCTION analytics.rating_opens_on(integer, text);",
        ),
        migrations.RunSQL(
            CREATE_RATING_PERIOD_START,
            reverse_sql="DROP FUNCTION analytics.rating_period_start(date);",
        ),
        migrations.RunSQL(
            CREATE_NEXT_RATING_PERIOD_START,
            reverse_sql="DROP FUNCTION analytics.next_rating_period_start(date);",
        ),
        migrations.RunSQL(
            CREATE_SEMESTER_ACADEMIC_YEAR,
            reverse_sql="DROP FUNCTION analytics.semester_academic_year(integer, text);",
        ),
        migrations.RunSQL(
            CREATE_ACADEMIC_YEAR_ON,
            reverse_sql="DROP FUNCTION analytics.academic_year_on(date);",
        ),
        migrations.RunSQL(
            CREATE_TODAY,
            reverse_sql="DROP FUNCTION analytics.today();",
        ),
        migrations.RunSQL(
            CREATE_IS_EXCLUDED,
            reverse_sql="DROP FUNCTION analytics.is_excluded(integer);",
        ),
    ]
