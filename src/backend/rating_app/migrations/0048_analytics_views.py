from django.db import migrations

COVERAGE = """
CREATE VIEW analytics.coverage AS
WITH offering AS (
    SELECT o.course_id, analytics.semester_academic_year(s.year, s.term) AS academic_year
    FROM rating_app_courseoffering o
    JOIN rating_app_semester s ON s.id = o.semester_id
),
newest AS (
    SELECT max(academic_year) AS academic_year FROM offering
),
available AS (
    SELECT DISTINCT o.course_id
    FROM offering o
    JOIN newest n ON n.academic_year = o.academic_year
),
covered AS (
    SELECT DISTINCT o.course_id
    FROM rating_app_rating r
    JOIN rating_app_courseoffering o ON o.id = r.course_offering_id
    JOIN rating_app_student st ON st.id = r.student_id
    WHERE NOT analytics.is_excluded(st.user_id)
)
SELECT
    (SELECT academic_year FROM newest) AS academic_year,
    count(*) AS courses_available,
    count(c.course_id) AS courses_covered,
    round(count(c.course_id)::numeric / nullif(count(*), 0), 4) AS share
FROM available a
LEFT JOIN covered c ON c.course_id = a.course_id;
"""

AUTHORS = """
CREATE VIEW analytics.authors AS
WITH can_rate AS (
    SELECT DISTINCT st.user_id
    FROM rating_app_student st
    JOIN rating_app_enrollment e ON e.student_id = st.id
    JOIN rating_app_courseoffering o ON o.id = e.offering_id
    JOIN rating_app_semester s ON s.id = o.semester_id
    WHERE st.user_id IS NOT NULL
      AND NOT analytics.is_excluded(st.user_id)
      AND e.status <> 'DROPPED'
      AND analytics.rating_opens_on(s.year, s.term) <= analytics.today()
),
author AS (
    SELECT DISTINCT st.user_id
    FROM rating_app_rating r
    JOIN rating_app_student st ON st.id = r.student_id
)
SELECT
    count(*) AS accounts_that_can_rate,
    count(a.user_id) AS authors,
    round(count(a.user_id)::numeric / nullif(count(*), 0), 4) AS share
FROM can_rate c
LEFT JOIN author a ON a.user_id = c.user_id;
"""

FIRST_REVIEW = """
CREATE VIEW analytics.first_review AS
WITH account AS (
    SELECT
        st.user_id,
        greatest(
            (u.date_joined AT TIME ZONE 'UTC')::date,
            min(analytics.rating_opens_on(s.year, s.term))
        ) AS could_rate_from
    FROM rating_app_student st
    JOIN auth_user u ON u.id = st.user_id
    JOIN rating_app_enrollment e ON e.student_id = st.id
    JOIN rating_app_courseoffering o ON o.id = e.offering_id
    JOIN rating_app_semester s ON s.id = o.semester_id
    WHERE NOT analytics.is_excluded(st.user_id)
      AND e.status <> 'DROPPED'
    GROUP BY st.user_id, u.date_joined
    HAVING min(analytics.rating_opens_on(s.year, s.term)) <= analytics.today()
),
first AS (
    SELECT st.user_id, min((r.created_at AT TIME ZONE 'UTC')::date) AS first_review_on
    FROM rating_app_rating r
    JOIN rating_app_student st ON st.id = r.student_id
    GROUP BY st.user_id
),
timed AS (
    SELECT
        analytics.rating_period_start(a.could_rate_from) AS rating_period,
        a.could_rate_from,
        -- greatest() ignores NULL
        CASE
            WHEN f.first_review_on IS NOT NULL
            THEN greatest(f.first_review_on - a.could_rate_from, 0)
        END AS days_to_first_review
    FROM account a
    LEFT JOIN first f ON f.user_id = a.user_id
),
grp AS (
    SELECT
        rating_period,
        count(*) AS accounts,
        analytics.today() - max(could_rate_from) AS youngest_age
    FROM timed
    GROUP BY rating_period
)
SELECT
    g.rating_period,
    d.day,
    g.accounts,
    count(t.rating_period) AS with_first_review,
    round(count(t.rating_period)::numeric / g.accounts, 4) AS share
FROM grp g
CROSS JOIN LATERAL generate_series(0, g.youngest_age) AS d(day)
LEFT JOIN timed t
    ON t.rating_period = g.rating_period AND t.days_to_first_review <= d.day
GROUP BY g.rating_period, d.day, g.accounts
ORDER BY g.rating_period, d.day;
"""

HABIT = """
CREATE VIEW analytics.habit AS
WITH review AS (
    SELECT
        st.user_id,
        analytics.rating_period_start((r.created_at AT TIME ZONE 'UTC')::date) AS rating_period
    FROM rating_app_rating r
    JOIN rating_app_student st ON st.id = r.student_id
    WHERE st.user_id IS NOT NULL
      AND NOT analytics.is_excluded(st.user_id)
),
author AS (
    SELECT
        user_id,
        analytics.next_rating_period_start(min(rating_period)) AS next_period,
        max(rating_period) > min(rating_period) AS wrote_again
    FROM review
    GROUP BY user_id
),
counted AS (
    SELECT a.*
    FROM author a
    WHERE analytics.next_rating_period_start(a.next_period) <= analytics.today()
      AND EXISTS (
          SELECT 1
          FROM rating_app_student st
          JOIN rating_app_enrollment e ON e.student_id = st.id
          JOIN rating_app_courseoffering o ON o.id = e.offering_id
          JOIN rating_app_semester s ON s.id = o.semester_id
          WHERE st.user_id = a.user_id
            AND e.status <> 'DROPPED'
            AND analytics.semester_academic_year(s.year, s.term)
                = analytics.academic_year_on(a.next_period)
      )
)
SELECT
    count(*) AS authors,
    count(*) FILTER (WHERE wrote_again) AS wrote_again,
    round(count(*) FILTER (WHERE wrote_again)::numeric / nullif(count(*), 0), 4) AS share
FROM counted;
"""

SUBSTANCE = """
CREATE VIEW analytics.substance AS
SELECT
    count(*) AS reviews,
    count(*) FILTER (WHERE r.comment ~ '[^[:space:]]') AS reviews_with_text,
    round(count(*) FILTER (WHERE r.comment ~ '[^[:space:]]')::numeric / nullif(count(*), 0), 4)
        AS share_with_text,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY char_length(r.comment))
        FILTER (WHERE r.comment ~ '[^[:space:]]') AS median_text_length
FROM rating_app_rating r
JOIN rating_app_student st ON st.id = r.student_id
WHERE NOT analytics.is_excluded(st.user_id);
"""

ANONYMOUS_SHARE = """
CREATE VIEW analytics.anonymous_share AS
SELECT
    date_trunc('month', r.created_at AT TIME ZONE 'UTC')::date AS month,
    count(*) AS reviews,
    count(*) FILTER (WHERE r.is_anonymous) AS anonymous_reviews,
    round(count(*) FILTER (WHERE r.is_anonymous)::numeric / count(*), 4) AS share
FROM rating_app_rating r
JOIN rating_app_student st ON st.id = r.student_id
WHERE NOT analytics.is_excluded(st.user_id)
GROUP BY 1
ORDER BY 1;
"""

STUDENT_REACH = """
CREATE VIEW analytics.student_reach AS
WITH studying AS (
    SELECT DISTINCT
        st.id,
        st.education_level,
        f.name AS faculty,
        st.user_id IS NOT NULL AS has_account
    FROM rating_app_student st
    JOIN rating_app_enrollment e ON e.student_id = st.id
    JOIN rating_app_courseoffering o ON o.id = e.offering_id
    JOIN rating_app_semester s ON s.id = o.semester_id
    JOIN rating_app_speciality sp ON sp.id = st.speciality_id
    JOIN rating_app_faculty f ON f.id = sp.faculty_id
    WHERE NOT analytics.is_excluded(st.user_id)
      AND e.status <> 'DROPPED'
      AND analytics.semester_academic_year(s.year, s.term)
          = analytics.academic_year_on(analytics.today())
)
SELECT
    'all' AS split,
    NULL::text AS name,
    count(*) AS students,
    count(*) FILTER (WHERE has_account) AS accounts,
    round(count(*) FILTER (WHERE has_account)::numeric / nullif(count(*), 0), 4) AS share,
    (
        SELECT count(*)
        FROM auth_user u
        WHERE NOT analytics.is_excluded(u.id)
          AND NOT EXISTS (SELECT 1 FROM rating_app_student st WHERE st.user_id = u.id)
    ) AS unlinked_accounts
FROM studying
UNION ALL
SELECT
    'faculty',
    faculty,
    count(*),
    count(*) FILTER (WHERE has_account),
    round(count(*) FILTER (WHERE has_account)::numeric / count(*), 4),
    NULL
FROM studying
GROUP BY faculty
UNION ALL
SELECT
    'degree',
    education_level,
    count(*),
    count(*) FILTER (WHERE has_account),
    round(count(*) FILTER (WHERE has_account)::numeric / count(*), 4),
    NULL
FROM studying
GROUP BY education_level;
"""

RETURN_ACTIVE_30D = """
CREATE VIEW analytics.return_active_30d AS
SELECT
    count(*) FILTER (WHERE u.last_login >= now() - interval '30 days') AS active_users,
    count(*) FILTER (
        WHERE u.last_login >= now() - interval '30 days'
          AND u.date_joined < now() - interval '30 days'
    ) AS returning_users,
    count(*) FILTER (WHERE u.date_joined >= now() - interval '30 days') AS new_users,
    count(*) AS registered_users
FROM auth_user u
WHERE NOT analytics.is_excluded(u.id);
"""

RETURN_RETENTION = """
CREATE VIEW analytics.return_retention AS
WITH log_start AS (
    SELECT min((signed_in_at AT TIME ZONE 'UTC')::date) AS day FROM rating_app_signin
),
member AS (
    SELECT u.id AS user_id, (u.date_joined AT TIME ZONE 'UTC')::date AS joined_on
    FROM auth_user u
    CROSS JOIN log_start l
    WHERE NOT analytics.is_excluded(u.id)
      AND (u.date_joined AT TIME ZONE 'UTC')::date >= l.day
),
cohort AS (
    SELECT
        date_trunc('month', joined_on)::date AS cohort_month,
        min(joined_on) AS joined_from,
        max(joined_on) AS joined_until,
        count(*) AS users
    FROM member
    GROUP BY 1
),
cell AS (
    SELECT c.cohort_month, c.joined_from, c.users, k AS period
    FROM cohort c
    -- Periods that have ended for every account in the cohort
    CROSS JOIN LATERAL generate_series(1, (analytics.today() - c.joined_until - 1) / 30) AS k
),
returned AS (
    SELECT DISTINCT
        m.user_id,
        date_trunc('month', m.joined_on)::date AS cohort_month,
        ((s.signed_in_at AT TIME ZONE 'UTC')::date - m.joined_on - 1) / 30 + 1 AS period
    FROM member m
    JOIN rating_app_signin s ON s.user_id = m.user_id
    WHERE (s.signed_in_at AT TIME ZONE 'UTC')::date > m.joined_on
)
SELECT
    c.cohort_month,
    c.joined_from,
    c.period,
    c.users,
    count(r.user_id) AS returned_users,
    round(count(r.user_id)::numeric / c.users, 4) AS share
FROM cell c
LEFT JOIN returned r ON r.cohort_month = c.cohort_month AND r.period = c.period
GROUP BY c.cohort_month, c.joined_from, c.period, c.users
ORDER BY c.cohort_month, c.period;
"""

VIEWS = {
    "coverage": COVERAGE,
    "authors": AUTHORS,
    "first_review": FIRST_REVIEW,
    "habit": HABIT,
    "substance": SUBSTANCE,
    "anonymous_share": ANONYMOUS_SHARE,
    "student_reach": STUDENT_REACH,
    "return_active_30d": RETURN_ACTIVE_30D,
    "return_retention": RETURN_RETENTION,
}


class Migration(migrations.Migration):
    dependencies = [
        ("rating_app", "0047_analytics_schema"),
    ]

    operations = [
        migrations.RunSQL(sql, reverse_sql=f"DROP VIEW analytics.{name};")
        for name, sql in VIEWS.items()
    ]
