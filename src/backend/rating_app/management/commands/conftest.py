from __future__ import annotations

import io
from contextlib import contextmanager
from datetime import timedelta

from django.core.management import call_command
from django.utils import timezone

import pytest

from rating_app.models import SyncChangeGroup, SyncRun, SyncRunStatus, SyncSource
from rating_app.sync import apply, revert

OLD_TITLE = "Тестова дисципліна А"
NEW_TITLE = "Тестова дисципліна Б"  # the test modules repeat both titles


@contextmanager
def _lock_free(_key: int):
    yield True


@pytest.fixture
def free_sync_lock(monkeypatch):
    """The tests run on SQLite, which has no advisory locks."""
    monkeypatch.setattr(apply, "advisory_lock", _lock_free)
    monkeypatch.setattr(revert, "advisory_lock", _lock_free)


@pytest.fixture
def run_catalog_sync():
    def run(*args: str) -> str:
        out = io.StringIO()
        call_command("catalog_sync", *args, stdout=out)
        return out.getvalue()

    return run


@pytest.fixture
def admin(user_factory):
    return user_factory(username="admin-test", is_superuser=True)


@pytest.fixture
def make_catalog_run(sync_run_factory):
    def make(*, age_hours: int = 1):
        run = sync_run_factory(
            source=SyncSource.CATALOG,
            status=SyncRunStatus.SUCCEEDED,
            finished_at=timezone.now() - timedelta(hours=age_hours),
        )
        # `started_at` is auto_now_add, so the factory cannot set it.
        SyncRun.objects.filter(pk=run.pk).update(
            started_at=timezone.now() - timedelta(hours=age_hours, minutes=4)
        )
        run.refresh_from_db()
        return run

    return make


@pytest.fixture
def make_title_change(sync_change_factory, course_factory):
    """A `change_course` that renames one course, as the nightly read records it."""

    def make(run, *, ratings: int = 0):
        course = course_factory(title=OLD_TITLE)
        change = sync_change_factory(
            run=run,
            source=SyncSource.CATALOG,
            group=SyncChangeGroup.CHANGE,
            kind="change_course",
            key=str(course.pk),
            target_id=str(course.pk),
            before={"title": OLD_TITLE},
            after={"title": NEW_TITLE},
            ratings=ratings,
        )
        return course, change

    return make
