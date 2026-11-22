from __future__ import annotations

from django.utils import timezone

import pytest

from rating_app.models import (
    CatalogMappingDecision,
    MappingAnswer,
    SyncChangeGroup,
    SyncRunStatus,
    SyncSource,
)
from rating_app.sync import answers


@pytest.fixture
def catalog_run(sync_run_factory):
    return sync_run_factory(
        source=SyncSource.CATALOG,
        status=SyncRunStatus.SUCCEEDED,
        finished_at=timezone.now(),
    )


@pytest.fixture
def admin(user_factory):
    return user_factory(username="admin-test", is_superuser=True)


@pytest.fixture
def make_question(sync_change_factory, course_factory, catalog_run):
    def make(key: str, *, kind: str = "merge_courses", courses=None):
        courses = courses or [course_factory(), course_factory()]
        return sync_change_factory(
            run=catalog_run,
            source=SyncSource.CATALOG,
            group=SyncChangeGroup.MAPPING,
            kind=kind,
            key=key,
            ukma_data_id=key,
            after={
                "merge_source": None,
                "courses": [{"id": str(course.pk), "ratings": 0} for course in courses],
            },
        )

    return make


def _live(key: str):
    return CatalogMappingDecision.objects.filter(question_key=key, superseded_at__isnull=True)


@pytest.mark.django_db
@pytest.mark.integration
def test_keep_apart_unrated_settles_an_unanswered_unrated_question(admin, make_question):
    question = make_question("ud-course-test-1")

    count = answers.keep_apart_unrated(admin)

    assert count == 1
    decision = _live(question.key).get()
    assert decision.answer == MappingAnswer.KEEP_APART
    assert decision.decided_by == admin


@pytest.mark.django_db
@pytest.mark.integration
def test_keep_apart_unrated_skips_a_rated_question(
    admin, make_question, course_factory, course_offering_factory, rating_factory
):
    rated = course_factory()
    rating_factory(course_offering=course_offering_factory(course=rated))
    question = make_question("ud-course-test-2", courses=[rated, course_factory()])

    count = answers.keep_apart_unrated(admin)

    assert count == 0
    assert not _live(question.key).exists()


@pytest.mark.django_db
@pytest.mark.integration
def test_keep_apart_unrated_skips_a_kind_without_a_settling_answer(admin, make_question):
    question = make_question("ud-course-test-3", kind="place_offering")

    assert answers.keep_apart_unrated(admin) == 0
    assert not _live(question.key).exists()


@pytest.mark.django_db
@pytest.mark.integration
def test_keep_apart_unrated_keeps_a_live_answer_whose_premise_holds(admin, make_question):
    question = make_question("ud-course-test-4")
    held = answers.answer_change(
        question, MappingAnswer.MERGE, admin, into=question.after["courses"][0]["id"]
    )

    count = answers.keep_apart_unrated(admin)

    assert count == 0
    assert list(_live(question.key)) == [held]


@pytest.mark.django_db
@pytest.mark.integration
def test_keep_apart_unrated_re_answers_when_the_premise_changed(admin, make_question):
    question = make_question("ud-course-test-5")
    old = answers.answer_change(
        question, MappingAnswer.MERGE, admin, into=question.after["courses"][0]["id"]
    )
    CatalogMappingDecision.objects.filter(pk=old.pk).update(
        premise={**old.premise, "course_ids": ["00000000-0000-0000-0000-000000000000"]}
    )

    count = answers.keep_apart_unrated(admin)

    assert count == 1
    old.refresh_from_db()
    assert old.superseded_at is not None
    assert _live(question.key).get().answer == MappingAnswer.KEEP_APART


@pytest.mark.django_db
@pytest.mark.integration
def test_keep_apart_unrated_without_a_succeeded_run_does_nothing(admin):
    assert answers.keep_apart_unrated(admin) == 0
