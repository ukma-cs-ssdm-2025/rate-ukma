from __future__ import annotations

from django.core.management.base import CommandError

import pytest

from rating_app.models import Course, SyncApproval, SyncChangeState

OLD_TITLE = "Тестова дисципліна А"
NEW_TITLE = "Тестова дисципліна Б"


@pytest.mark.django_db
@pytest.mark.integration
@pytest.mark.usefixtures("free_sync_lock")
def test_apply_dry_run_lists_the_change_and_writes_nothing(
    run_catalog_sync, admin, make_catalog_run, make_title_change
):
    run = make_catalog_run()
    course, change = make_title_change(run, ratings=3)

    out = run_catalog_sync("apply", "--group", "change", "--by", admin.username)

    assert "Пробний запуск, нічого не записано." in out
    assert "Застосувало б 1 зміну: зміни курсів 1." in out
    assert f"#{change.pk}" in out
    assert f"назва: «{OLD_TITLE}» → «{NEW_TITLE}»" in out
    assert "3 оцінки" in out
    assert "Щоб записати: додайте --yes." in out
    change.refresh_from_db()
    course.refresh_from_db()
    assert change.state == SyncChangeState.PROPOSED
    assert course.title == OLD_TITLE
    assert not SyncApproval.objects.exists()


@pytest.mark.django_db
@pytest.mark.integration
@pytest.mark.usefixtures("free_sync_lock")
def test_apply_yes_writes_through_the_approval_service(
    run_catalog_sync, admin, make_catalog_run, make_title_change
):
    run = make_catalog_run()
    course, change = make_title_change(run)

    out = run_catalog_sync("apply", "--ids", str(change.pk), "--by", admin.username, "--yes")

    approval = SyncApproval.objects.get()
    assert f"Рішення #{approval.pk}." in out
    assert approval.user == admin
    change.refresh_from_db()
    assert change.state == SyncChangeState.APPLIED
    assert Course.objects.get(pk=course.pk).title == NEW_TITLE


@pytest.mark.django_db
@pytest.mark.integration
def test_apply_yes_requires_by(run_catalog_sync, make_catalog_run, make_title_change):
    run = make_catalog_run()
    make_title_change(run)

    with pytest.raises(CommandError, match="Вкажіть --by <username>"):
        run_catalog_sync("apply", "--group", "change", "--yes")

    assert not SyncApproval.objects.exists()


@pytest.mark.django_db
@pytest.mark.integration
def test_apply_refuses_a_user_who_is_not_a_superuser(
    run_catalog_sync, user_factory, make_catalog_run, make_title_change
):
    user_factory(username="student-test")
    make_title_change(make_catalog_run())

    with pytest.raises(CommandError, match="не адміністратор"):
        run_catalog_sync("apply", "--group", "change", "--by", "student-test", "--yes")


@pytest.mark.django_db
@pytest.mark.integration
def test_apply_asks_for_a_selection(run_catalog_sync, admin, make_catalog_run):
    make_catalog_run()

    with pytest.raises(CommandError, match="--group <група> або --ids"):
        run_catalog_sync("apply", "--by", admin.username)


@pytest.mark.django_db
@pytest.mark.integration
@pytest.mark.usefixtures("free_sync_lock")
def test_apply_refuses_a_stale_run_without_confirm_stale(
    run_catalog_sync, admin, make_catalog_run, make_title_change
):
    run = make_catalog_run(age_hours=60)
    _, change = make_title_change(run)

    with pytest.raises(CommandError, match="--confirm-stale"):
        run_catalog_sync("apply", "--group", "change", "--by", admin.username, "--yes")

    change.refresh_from_db()
    assert change.state == SyncChangeState.PROPOSED


@pytest.mark.django_db
@pytest.mark.integration
@pytest.mark.usefixtures("free_sync_lock")
def test_apply_writes_a_stale_run_with_confirm_stale(
    run_catalog_sync, admin, make_catalog_run, make_title_change
):
    run = make_catalog_run(age_hours=60)
    _, change = make_title_change(run)

    run_catalog_sync(
        "apply", "--group", "change", "--by", admin.username, "--yes", "--confirm-stale"
    )

    change.refresh_from_db()
    assert change.state == SyncChangeState.APPLIED


@pytest.mark.django_db
@pytest.mark.integration
@pytest.mark.usefixtures("free_sync_lock")
def test_reject_dry_run_writes_nothing(
    run_catalog_sync, admin, make_catalog_run, make_title_change
):
    _, change = make_title_change(make_catalog_run())

    out = run_catalog_sync("reject", "--ids", str(change.pk), "--by", admin.username)

    assert "Відхилило б 1 зміну" in out
    change.refresh_from_db()
    assert change.state == SyncChangeState.PROPOSED
    assert not SyncApproval.objects.exists()


@pytest.mark.django_db
@pytest.mark.integration
@pytest.mark.usefixtures("free_sync_lock")
def test_reject_yes_marks_the_change_rejected(
    run_catalog_sync, admin, make_catalog_run, make_title_change
):
    _, change = make_title_change(make_catalog_run())

    out = run_catalog_sync("reject", "--ids", str(change.pk), "--by", admin.username, "--yes")

    assert "Відхилено 1 зміну" in out
    assert "повернуться з наступним читанням" in out
    change.refresh_from_db()
    assert change.state == SyncChangeState.REJECTED
    assert SyncApproval.objects.get().user == admin


@pytest.mark.django_db
@pytest.mark.integration
def test_apply_says_when_an_id_does_not_exist(run_catalog_sync, admin, make_catalog_run):
    make_catalog_run()

    with pytest.raises(CommandError, match="Деяких вибраних змін не існує"):
        run_catalog_sync("apply", "--ids", "999999", "--by", admin.username)
