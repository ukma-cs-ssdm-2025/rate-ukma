from pathlib import Path

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.db import connection, connections
from django.db.utils import DatabaseError

import psycopg2
import pytest
from decouple import config

from rating_app.models import (
    Comment,
    Course,
    CourseOffering,
    FeedPost,
    Instructor,
    Rating,
    Student,
)

ANONYMISE_SQL = Path(__file__).resolve().parents[3] / "scripts" / "staging" / "anonymise.sql"
PLACEHOLDER = "Текст прихований на staging."
SCRATCH_DB = "rateukma_anonymise_test"

User = get_user_model()


def _postgres_settings():
    return {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": SCRATCH_DB,
        "USER": config("POSTGRES_USER", default=""),
        "PASSWORD": config("POSTGRES_PASSWORD", default=""),
        "HOST": config("POSTGRES_HOST", default=""),
        "PORT": config("POSTGRES_PORT", default="5432"),
        "OPTIONS": {"connect_timeout": 5},
        "ATOMIC_REQUESTS": False,
        "AUTOCOMMIT": True,
        "CONN_MAX_AGE": 0,
        "CONN_HEALTH_CHECKS": False,
        "TIME_ZONE": None,
        "TEST": {
            "NAME": SCRATCH_DB,
            "MIRROR": None,
            "CHARSET": None,
            "COLLATION": None,
            "MIGRATE": True,
        },
    }


@pytest.fixture(scope="module")
def postgres_db(django_db_blocker):
    """A scratch PostgreSQL database that anonymise.sql needs but SQLite cannot run."""
    pg = _postgres_settings()
    try:
        admin = psycopg2.connect(
            dbname="postgres",
            user=pg["USER"],
            password=pg["PASSWORD"],
            host=pg["HOST"],
            port=pg["PORT"],
            connect_timeout=2,
        )
    except psycopg2.OperationalError as exc:
        pytest.skip(f"PostgreSQL is not reachable: {exc}")

    admin.autocommit = True
    with admin.cursor() as cursor:
        cursor.execute(f'DROP DATABASE IF EXISTS "{pg["NAME"]}"')
        cursor.execute(f'CREATE DATABASE "{pg["NAME"]}"')
    admin.close()

    previous = settings.DATABASES["default"]
    connections.close_all()
    try:
        del connections["default"]
    except AttributeError:
        pass
    settings.DATABASES["default"] = pg

    with django_db_blocker.unblock():
        with connection.cursor() as cursor:
            cursor.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
        call_command("migrate", run_syncdb=True, verbosity=0, interactive=False)

    yield

    connections.close_all()
    try:
        del connections["default"]
    except AttributeError:
        pass
    settings.DATABASES["default"] = previous


def _anonymise(*, allow_test):
    with connection.cursor() as cursor:
        if allow_test:
            cursor.execute("SET anonymise.allow_test = on")
        cursor.execute(ANONYMISE_SQL.read_text(encoding="utf-8"))


@pytest.mark.django_db(transaction=True)
@pytest.mark.integration
def test_anonymise_removes_personal_data_and_keeps_row_counts(
    postgres_db,
    user_factory,
    student_factory,
    instructor_factory,
    course_factory,
    course_offering_factory,
    rating_factory,
    comment_factory,
    feed_post_factory,
):
    student_user = user_factory(
        username="student-original",
        email="original.student@ukma.edu.ua",
        first_name="Оригінальна",
        last_name="Особистість",
    )
    admin_user = user_factory(
        username="admin-original",
        email="original.admin@ukma.edu.ua",
        first_name="Справжній",
        last_name="Адміністратор",
        is_superuser=True,
        is_staff=True,
    )
    student = student_factory(
        user=student_user,
        first_name="Оригінальна",
        last_name="Особистість",
        patronymic="По-батькові",
        email="original.student@ukma.edu.ua",
    )
    instructor = instructor_factory(
        first_name="Справжній",
        last_name="Науковець",
        patronymic="По-батькові",
        email="original.teacher@ukma.edu.ua",
    )
    course = course_factory(title="Курс з відгуками")
    offering = course_offering_factory(course=course)
    rating = rating_factory(
        student=student,
        course_offering=offering,
        comment="Дуже корисний курс, раджу всім.",
        instructor="Справжній Науковець",
    )
    empty_rating = rating_factory(
        student=student,
        course_offering=course_offering_factory(course=course),
        comment="",
    )
    comment = comment_factory(rating=rating, user=student_user, content="Це мій відгук.")
    feed_post = feed_post_factory(title="Оголошення від Оригінальної", body="Текст від студентки.")

    counts_before = {
        "users": User.objects.count(),
        "students": Student.objects.count(),
        "instructors": Instructor.objects.count(),
        "courses": Course.objects.count(),
        "offerings": CourseOffering.objects.count(),
        "ratings": Rating.objects.count(),
        "comments": Comment.objects.count(),
        "feed_posts": FeedPost.objects.count(),
    }

    _anonymise(allow_test=True)

    assert {
        "users": User.objects.count(),
        "students": Student.objects.count(),
        "instructors": Instructor.objects.count(),
        "courses": Course.objects.count(),
        "offerings": CourseOffering.objects.count(),
        "ratings": Rating.objects.count(),
        "comments": Comment.objects.count(),
        "feed_posts": FeedPost.objects.count(),
    } == counts_before

    original_emails = [
        "original.student@ukma.edu.ua",
        "original.admin@ukma.edu.ua",
        "original.teacher@ukma.edu.ua",
        "student-original",
        "admin-original",
    ]
    assert not User.objects.filter(email__in=original_emails).exists()
    assert not User.objects.filter(username__in=original_emails).exists()
    assert not Student.objects.filter(email__in=original_emails).exists()
    assert not Instructor.objects.filter(email__in=original_emails).exists()

    original_names = [
        "Оригінальна",
        "Особистість",
        "Справжній",
        "Адміністратор",
        "Науковець",
    ]
    assert not User.objects.filter(first_name__in=original_names).exists()
    assert not User.objects.filter(last_name__in=original_names).exists()
    assert not Student.objects.filter(first_name__in=original_names).exists()
    assert not Student.objects.filter(last_name__in=original_names).exists()
    assert not Instructor.objects.filter(first_name__in=original_names).exists()
    assert not Instructor.objects.filter(last_name__in=original_names).exists()

    assert not Rating.objects.filter(comment__in=["Дуже корисний курс, раджу всім."]).exists()
    assert not Comment.objects.filter(content="Це мій відгук.").exists()
    assert not FeedPost.objects.filter(title="Оголошення від Оригінальної").exists()
    assert not FeedPost.objects.filter(body="Текст від студентки.").exists()

    student.refresh_from_db()
    assert student.first_name == "Студент"
    assert student.last_name.isdigit()
    assert student.patronymic == ""
    assert student.email == f"student-{student.last_name}@example.invalid"
    assert not student.avatar

    instructor.refresh_from_db()
    assert instructor.first_name == "Викладач"
    assert instructor.last_name.isdigit()
    assert instructor.patronymic == ""
    assert instructor.email == f"teacher-{instructor.last_name}@example.invalid"

    admin_user.refresh_from_db()
    assert admin_user.username == f"user-{admin_user.id}"
    assert admin_user.email == f"user-{admin_user.id}@example.invalid"
    assert admin_user.first_name == ""
    assert admin_user.last_name == ""
    assert admin_user.password == "!"
    assert admin_user.is_superuser is True
    assert admin_user.is_staff is True
    assert admin_user.is_active is True

    rating.refresh_from_db()
    assert rating.comment == PLACEHOLDER
    assert rating.instructor == ""
    empty_rating.refresh_from_db()
    assert empty_rating.comment == ""

    comment.refresh_from_db()
    assert comment.content == PLACEHOLDER

    feed_post.refresh_from_db()
    assert feed_post.title == PLACEHOLDER
    assert feed_post.body == PLACEHOLDER


@pytest.mark.django_db(transaction=True)
@pytest.mark.integration
def test_anonymise_refuses_without_the_test_setting_outside_rateukma_anon(
    postgres_db, user_factory
):
    user_factory(email="guard@ukma.edu.ua", first_name="Вартовий")

    with pytest.raises(DatabaseError, match="refusing to anonymise"):
        _anonymise(allow_test=False)
    with connection.cursor() as cursor:
        cursor.execute("ROLLBACK")

    assert User.objects.filter(email="guard@ukma.edu.ua", first_name="Вартовий").exists()


# Every table the migrations create, each reviewed for personal data. A new
# table fails the test below until it is added here and, if it holds personal
# data or text a person wrote, anonymised or emptied in anonymise.sql.
HANDLED_BY_ANONYMISE = {
    "account_emailaddress",
    "account_emailconfirmation",
    "auth_user",
    "authtoken_token",
    "django_admin_log",
    "django_session",
    "rating_app_comment",
    "rating_app_feedpost",
    "rating_app_instructor",
    "rating_app_rating",
    "rating_app_signin",
    "rating_app_student",
    "reversion_revision",
    "reversion_version",
    "socialaccount_socialaccount",
    "socialaccount_socialapp",
    "socialaccount_socialapp_sites",
    "socialaccount_socialtoken",
    "waffle_flag_users",
    "rating_app_syncapproval",
    "rating_app_syncchange",
    "rating_app_syncrun",
}
NO_PERSONAL_DATA = {
    "auth_group",
    "auth_group_permissions",
    "auth_permission",
    "auth_user_groups",
    "auth_user_user_permissions",
    "django_content_type",
    "django_migrations",
    "django_site",
    "rating_app_course",
    "rating_app_courseinstructor",
    "rating_app_courseoffering",
    "rating_app_courseofferingspeciality",
    "rating_app_courseofferingterm",
    "rating_app_department",
    "rating_app_enrollment",
    "rating_app_faculty",
    "rating_app_feedevent",
    "rating_app_notification",
    "rating_app_notificationcursor",
    "rating_app_notificationgroupread",
    "rating_app_plannedcourse",
    "rating_app_promobanner",
    "rating_app_rating_instructors",
    "rating_app_ratingvote",
    "rating_app_semester",
    "rating_app_catalogmappingdecision",
    "rating_app_synccursor",
    "rating_app_syncpolicy",
    "rating_app_syncpolicychange",
    "rating_app_speciality",
    "waffle_flag",
    "waffle_flag_groups",
    "waffle_sample",
    "waffle_switch",
}


@pytest.mark.django_db(transaction=True)
@pytest.mark.integration
def test_every_table_is_reviewed_for_personal_data(postgres_db):
    with connection.cursor() as cursor:
        cursor.execute("SELECT tablename FROM pg_tables WHERE schemaname = 'public'")
        tables = {row[0] for row in cursor.fetchall()}

    unreviewed = tables - HANDLED_BY_ANONYMISE - NO_PERSONAL_DATA
    assert not unreviewed, f"review these tables for personal data in anonymise.sql: {unreviewed}"
