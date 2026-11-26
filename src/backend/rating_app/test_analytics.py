from datetime import UTC, date, datetime, time, timedelta
from decimal import Decimal

from django.db import connection

import pytest
from freezegun import freeze_time

from rating_app.ioc_container.services import rating_service, semester_service
from rating_app.models import Rating, SignIn
from rating_app.models.choices import EducationLevel, EnrollmentStatus, SemesterTerm

BOUNDARY_DATES = [
    date(2025, 1, 1),
    date(2025, 2, 28),
    date(2025, 3, 1),
    date(2025, 4, 30),
    date(2025, 5, 1),
    date(2025, 5, 31),
    date(2025, 6, 1),
    date(2025, 8, 31),
    date(2025, 9, 1),
    date(2025, 10, 31),
    date(2025, 11, 1),
    date(2025, 12, 31),
]

PERSONAL_COLUMNS = {
    "id",
    "user_id",
    "student_id",
    "email",
    "username",
    "first_name",
    "last_name",
    "patronymic",
    "comment",
}


def _today() -> date:
    return datetime.now(UTC).date()


def _noon(day: date) -> datetime:
    return datetime.combine(day, time(12), tzinfo=UTC)


def _rows(view: str) -> list[dict]:
    with connection.cursor() as cursor:
        cursor.execute(f"SELECT * FROM analytics.{view}")
        columns = [column[0] for column in cursor.description]
        return [dict(zip(columns, row, strict=True)) for row in cursor.fetchall()]


def _value(sql: str, params: list):
    with connection.cursor() as cursor:
        cursor.execute(sql, params)
        return cursor.fetchone()[0]


@pytest.fixture
def make_review(rating_factory):
    def make(on: date | None = None, **kwargs):
        review = rating_factory(**kwargs)
        if on is not None:
            # auto_now_add overwrites a value passed on create
            Rating.objects.filter(pk=review.pk).update(created_at=_noon(on))
        return review

    return make


@pytest.fixture
def make_sign_in(sign_in_factory):
    def make(user, on: date):
        sign_in = sign_in_factory(user=user)
        SignIn.objects.filter(pk=sign_in.pk).update(signed_in_at=_noon(on))

    return make


@pytest.fixture
def open_semester(semester_factory):
    return semester_factory(year=_today().year - 2, term=SemesterTerm.FALL)


@pytest.mark.django_db
@pytest.mark.integration
@pytest.mark.postgres
@pytest.mark.parametrize("today", BOUNDARY_DATES)
def test_rating_opens_on_matches_rating_service_when_today_is_a_boundary(semester_factory, today):
    semesters = [
        semester_factory(year=year, term=term)
        for year in (2024, 2025, 2026)
        for term in SemesterTerm
    ]

    with freeze_time(today):
        in_python = {
            (s.year, s.term): rating_service().is_semester_open_for_rating(s) for s in semesters
        }
    in_sql = {
        (s.year, s.term): _value(
            "SELECT %s >= analytics.rating_opens_on(%s, %s)", [today, s.year, s.term]
        )
        for s in semesters
    }

    assert in_sql == in_python


@pytest.mark.django_db
@pytest.mark.integration
@pytest.mark.postgres
@pytest.mark.parametrize("today", BOUNDARY_DATES)
def test_academic_year_on_matches_semester_service_when_today_is_a_boundary(today):
    with freeze_time(today):
        in_python = semester_service().get_current_academic_year_start()

    assert _value("SELECT analytics.academic_year_on(%s)", [today]) == in_python


@pytest.mark.django_db
@pytest.mark.integration
@pytest.mark.postgres
def test_semester_academic_year_matches_semester_service():
    semesters = [(year, term) for year in (2024, 2025) for term in SemesterTerm]

    in_sql = [
        _value("SELECT analytics.semester_academic_year(%s, %s)", [year, term])
        for year, term in semesters
    ]

    assert in_sql == [
        semester_service().get_academic_year_start(year, term) for year, term in semesters
    ]


@pytest.mark.django_db
@pytest.mark.integration
@pytest.mark.postgres
def test_analytics_views_expose_no_personal_columns():
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT column_name FROM information_schema.columns WHERE table_schema = 'analytics'"
        )
        columns = {row[0] for row in cursor.fetchall()}

    assert columns
    assert not columns & PERSONAL_COLUMNS


@pytest.mark.django_db
@pytest.mark.integration
@pytest.mark.postgres
def test_coverage_counts_newest_year_courses_with_a_review_from_any_year(
    semester_factory,
    course_factory,
    course_offering_factory,
    student_factory,
    excluded_account_factory,
    make_review,
):
    newest_autumn = semester_factory(year=2031, term=SemesterTerm.FALL)
    newest_spring = semester_factory(year=2032, term=SemesterTerm.SPRING)
    older = semester_factory(year=2030, term=SemesterTerm.FALL)
    reviewed = course_factory()
    unreviewed = course_factory()
    not_offered = course_factory()
    course_offering_factory(course=reviewed, semester=newest_autumn)
    reviewed_before = course_offering_factory(course=reviewed, semester=older)
    unreviewed_now = course_offering_factory(course=unreviewed, semester=newest_spring)
    not_offered_before = course_offering_factory(course=not_offered, semester=older)
    make_review(course_offering=reviewed_before)
    make_review(course_offering=not_offered_before)
    excluded = excluded_account_factory()
    make_review(course_offering=unreviewed_now, student=student_factory(user=excluded.user))

    rows = _rows("coverage")

    assert rows == [
        {
            "academic_year": 2031,
            "courses_available": 2,
            "courses_covered": 1,
            "share": Decimal("0.5000"),
        }
    ]


@pytest.mark.django_db
@pytest.mark.integration
@pytest.mark.postgres
def test_authors_counts_only_accounts_that_can_rate(
    semester_factory,
    open_semester,
    course_offering_factory,
    student_factory,
    enrollment_factory,
    excluded_account_factory,
    make_review,
):
    future = semester_factory(year=_today().year + 1, term=SemesterTerm.FALL)
    open_offering = course_offering_factory(semester=open_semester)
    author = student_factory(with_user=True)
    reader = student_factory(with_user=True)
    not_open_yet = student_factory(with_user=True)
    dropped = student_factory(with_user=True)
    excluded = student_factory(user=excluded_account_factory().user)
    for student in (author, reader, excluded):
        enrollment_factory(student=student, offering=open_offering)
    enrollment_factory(student=not_open_yet, offering=course_offering_factory(semester=future))
    enrollment_factory(student=dropped, offering=open_offering, status=EnrollmentStatus.DROPPED)
    make_review(student=author, course_offering=open_offering)

    rows = _rows("authors")

    assert rows == [{"accounts_that_can_rate": 2, "authors": 1, "share": Decimal("0.5000")}]


@pytest.mark.django_db
@pytest.mark.integration
@pytest.mark.postgres
def test_first_review_counts_days_from_when_the_account_could_rate(
    open_semester,
    course_offering_factory,
    user_factory,
    student_factory,
    enrollment_factory,
    excluded_account_factory,
    make_review,
):
    joined_on = _today() - timedelta(days=40)
    offering = course_offering_factory(semester=open_semester)
    writer = student_factory(user=user_factory(date_joined=_noon(joined_on)))
    silent = student_factory(user=user_factory(date_joined=_noon(joined_on)))
    dropped = student_factory(user=user_factory(date_joined=_noon(joined_on)))
    excluded_user = excluded_account_factory(user=user_factory(date_joined=_noon(joined_on))).user
    excluded = student_factory(user=excluded_user)
    for student in (writer, silent, excluded):
        enrollment_factory(student=student, offering=offering)
    enrollment_factory(student=dropped, offering=offering, status=EnrollmentStatus.DROPPED)
    make_review(student=writer, course_offering=offering, on=joined_on + timedelta(days=3))
    make_review(student=excluded, course_offering=offering, on=joined_on + timedelta(days=1))

    rows = _rows("first_review")

    assert len({row["rating_period"] for row in rows}) == 1
    assert {row["accounts"] for row in rows} == {2}
    by_day = {row["day"]: row["with_first_review"] for row in rows}
    assert max(by_day) == 40
    assert (by_day[2], by_day[3], by_day[40]) == (0, 1, 1)


@pytest.mark.django_db
@pytest.mark.integration
@pytest.mark.postgres
def test_first_review_starts_the_clock_when_rating_opens_after_registration(
    semester_factory,
    open_semester,
    course_offering_factory,
    user_factory,
    student_factory,
    enrollment_factory,
    make_review,
):
    opens_on = date(_today().year - 1, 3, 1)
    offering = course_offering_factory(
        semester=semester_factory(year=opens_on.year, term=SemesterTerm.SPRING)
    )
    early = student_factory(user=user_factory(date_joined=_noon(opens_on - timedelta(days=90))))
    enrollment_factory(student=early, offering=offering)
    make_review(student=early, course_offering=offering, on=opens_on + timedelta(days=2))
    recent = student_factory(user=user_factory(date_joined=_noon(_today() - timedelta(days=40))))
    enrollment_factory(student=recent, offering=course_offering_factory(semester=open_semester))

    rows = _rows("first_review")

    early_group = {
        row["day"]: row["with_first_review"] for row in rows if row["rating_period"] == opens_on
    }
    assert (early_group[1], early_group[2]) == (0, 1)
    last_day = {}
    for row in rows:
        last_day[row["rating_period"]] = max(last_day.get(row["rating_period"], 0), row["day"])
    assert sorted(last_day.values()) == [40, (_today() - opens_on).days]


@pytest.mark.django_db
@pytest.mark.integration
@pytest.mark.postgres
def test_habit_counts_authors_still_studying_once_their_next_period_has_ended(
    semester_factory,
    course_offering_factory,
    student_factory,
    enrollment_factory,
    excluded_account_factory,
    make_review,
):
    today = _today()
    first_review_on = today - timedelta(days=730)
    recent_semesters = [
        semester_factory(year=year, term=term)
        for year in range(today.year - 4, today.year + 1)
        for term in (SemesterTerm.SPRING, SemesterTerm.FALL)
    ]
    long_ago = semester_factory(year=today.year - 8, term=SemesterTerm.FALL)
    period_now = _value("SELECT analytics.rating_period_start(analytics.today())", [])
    again = student_factory(with_user=True)
    once = student_factory(with_user=True)
    left = student_factory(with_user=True)
    next_period_running = student_factory(with_user=True)
    excluded = student_factory(user=excluded_account_factory().user)
    for student in (again, once, next_period_running, excluded):
        for semester in recent_semesters:
            enrollment_factory(student=student, offering=course_offering_factory(semester=semester))
    enrollment_factory(student=left, offering=course_offering_factory(semester=long_ago))
    for student in (again, once, once, left, excluded):
        make_review(student=student, course_offering=course_offering_factory(), on=first_review_on)
    for student in (again, excluded):
        make_review(
            student=student,
            course_offering=course_offering_factory(),
            on=today - timedelta(days=400),
        )
    make_review(
        student=next_period_running,
        course_offering=course_offering_factory(),
        on=period_now - timedelta(days=1),
    )

    rows = _rows("habit")

    assert rows == [{"authors": 2, "wrote_again": 1, "share": Decimal("0.5000")}]


@pytest.mark.django_db
@pytest.mark.integration
@pytest.mark.postgres
def test_substance_takes_median_length_over_reviews_with_text(
    student_factory, excluded_account_factory, make_review
):
    for comment in ("", "   ", "abc", "abcdefg"):
        make_review(comment=comment)
    excluded = student_factory(user=excluded_account_factory().user)
    make_review(student=excluded, comment="a much longer review text")

    rows = _rows("substance")

    assert rows == [
        {
            "reviews": 4,
            "reviews_with_text": 2,
            "share_with_text": Decimal("0.5000"),
            "median_text_length": 5.0,
        }
    ]


@pytest.mark.django_db
@pytest.mark.integration
@pytest.mark.postgres
def test_anonymous_share_groups_reviews_by_month(
    student_factory, excluded_account_factory, make_review
):
    make_review(on=date(2026, 1, 15), is_anonymous=True)
    make_review(on=date(2026, 1, 20), is_anonymous=False)
    make_review(on=date(2026, 2, 10), is_anonymous=True)
    excluded = student_factory(user=excluded_account_factory().user)
    make_review(student=excluded, on=date(2026, 1, 25), is_anonymous=True)

    rows = _rows("anonymous_share")

    assert rows == [
        {
            "month": date(2026, 1, 1),
            "reviews": 2,
            "anonymous_reviews": 1,
            "share": Decimal("0.5000"),
        },
        {
            "month": date(2026, 2, 1),
            "reviews": 1,
            "anonymous_reviews": 1,
            "share": Decimal("1.0000"),
        },
    ]


@pytest.mark.django_db
@pytest.mark.integration
@pytest.mark.postgres
def test_student_reach_counts_students_of_the_academic_year_in_progress(
    semester_factory,
    course_offering_factory,
    speciality_factory,
    user_factory,
    student_factory,
    enrollment_factory,
    excluded_account_factory,
):
    academic_year = semester_service().get_current_academic_year_start()
    current = course_offering_factory(
        semester=semester_factory(year=academic_year, term=SemesterTerm.FALL)
    )
    previous = course_offering_factory(
        semester=semester_factory(year=academic_year - 1, term=SemesterTerm.FALL)
    )
    speciality = speciality_factory()
    with_account = student_factory(with_user=True, speciality=speciality)
    without_account = student_factory(speciality=speciality, education_level=EducationLevel.MASTER)
    left = student_factory(with_user=True)
    dropped = student_factory(with_user=True)
    excluded = student_factory(user=excluded_account_factory().user)
    enrollment_factory(student=with_account, offering=current)
    enrollment_factory(student=excluded, offering=current)
    enrollment_factory(student=without_account, offering=current)
    enrollment_factory(student=left, offering=previous)
    enrollment_factory(student=dropped, offering=current, status=EnrollmentStatus.DROPPED)
    user_factory()
    excluded_account_factory()

    rows = _rows("student_reach")

    assert sorted(
        (
            row["split"],
            row["name"] or "",
            row["students"],
            row["accounts"],
            row["unlinked_accounts"],
        )
        for row in rows
    ) == [
        ("all", "", 2, 1, 1),
        ("degree", EducationLevel.BACHELOR.value, 1, 1, None),
        ("degree", EducationLevel.MASTER.value, 1, 0, None),
        ("faculty", speciality.faculty.name, 2, 1, None),
    ]


@pytest.mark.django_db
@pytest.mark.integration
@pytest.mark.postgres
def test_return_active_30d_splits_active_users_into_new_and_returning(
    user_factory, excluded_account_factory
):
    now = datetime.now(UTC)
    user_factory(date_joined=now - timedelta(days=5), last_login=now - timedelta(days=5))
    user_factory(date_joined=now - timedelta(days=100), last_login=now - timedelta(days=2))
    user_factory(date_joined=now - timedelta(days=100), last_login=now - timedelta(days=40))
    excluded_account_factory(user=user_factory(last_login=now - timedelta(days=1)))

    rows = _rows("return_active_30d")

    assert rows == [
        {"active_users": 2, "returning_users": 1, "new_users": 1, "registered_users": 3}
    ]


@pytest.mark.django_db
@pytest.mark.integration
@pytest.mark.postgres
def test_return_retention_counts_returns_in_each_account_own_30_day_periods(
    user_factory, make_sign_in, excluded_account_factory
):
    # On the 30n-th day the last joiner's period n is still running, while an
    # earlier joiner in the same month has finished it
    days_since_last = next(d for d in (120, 150, 180) if (_today() - timedelta(days=d)).day != 1)
    joined_last = _today() - timedelta(days=days_since_last)
    joined_on = joined_last.replace(day=1)
    returns_twice = user_factory(date_joined=_noon(joined_on))
    never_returns = user_factory(date_joined=_noon(joined_on))
    joins_later = user_factory(date_joined=_noon(joined_last))
    joined_before_log = user_factory(date_joined=_noon(joined_on - timedelta(days=10)))
    excluded = excluded_account_factory(user=user_factory(date_joined=_noon(joined_on))).user
    for user in (returns_twice, never_returns, excluded):
        make_sign_in(user, joined_on)
    make_sign_in(never_returns, joined_on)
    make_sign_in(joins_later, joined_last)
    for days in (5, 40):
        make_sign_in(returns_twice, joined_on + timedelta(days=days))
    make_sign_in(joined_before_log, joined_on + timedelta(days=5))
    make_sign_in(excluded, joined_on + timedelta(days=5))

    rows = _rows("return_retention")

    assert [row["period"] for row in rows] == list(range(1, days_since_last // 30))
    assert {(row["cohort_month"], row["joined_from"], row["users"]) for row in rows} == {
        (joined_on, joined_on, 3)
    }
    returned = {row["period"]: row["returned_users"] for row in rows}
    assert (returned[1], returned[2], returned[3]) == (1, 1, 0)
