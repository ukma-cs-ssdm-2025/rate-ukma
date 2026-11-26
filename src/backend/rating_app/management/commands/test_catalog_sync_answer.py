from __future__ import annotations

from django.core.management.base import CommandError

import pytest
from structlog.testing import capture_logs

from rating_app.models import CatalogMappingDecision, MappingAnswer, SyncChangeGroup, SyncSource


@pytest.fixture
def merge_question(make_catalog_run, sync_change_factory, course_factory):
    run = make_catalog_run()
    courses = [course_factory(), course_factory()]
    return sync_change_factory(
        run=run,
        source=SyncSource.CATALOG,
        group=SyncChangeGroup.MAPPING,
        kind="merge_courses",
        key="ud-course-test",
        ukma_data_id="ud-course-test",
        after={
            "merge_source": None,
            "courses": [{"id": str(course.pk), "ratings": 0} for course in courses],
        },
    )


@pytest.mark.django_db
@pytest.mark.integration
def test_answer_dry_run_writes_no_decision(run_catalog_sync, admin, merge_question):
    out = run_catalog_sync("answer", str(merge_question.pk), "keep_apart", "--by", admin.username)

    assert "Пробний запуск, нічого не записано." in out
    assert f"Записало б: #{merge_question.pk}" in out
    assert not CatalogMappingDecision.objects.exists()


@pytest.mark.django_db
@pytest.mark.integration
def test_answer_yes_writes_the_decision(run_catalog_sync, admin, merge_question):
    out = run_catalog_sync(
        "answer", str(merge_question.pk), "keep_apart", "--by", admin.username, "--yes"
    )

    assert "Відповідь записано" in out
    decision = CatalogMappingDecision.objects.get()
    assert decision.answer == MappingAnswer.KEEP_APART
    assert decision.decided_by == admin


@pytest.mark.django_db
@pytest.mark.integration
def test_answer_yes_requires_by(run_catalog_sync, merge_question):
    with pytest.raises(CommandError, match="Вкажіть --by"):
        run_catalog_sync("answer", str(merge_question.pk), "keep_apart", "--yes")

    assert not CatalogMappingDecision.objects.exists()


@pytest.mark.django_db
@pytest.mark.integration
def test_answer_names_the_choices_a_question_takes(run_catalog_sync, admin, merge_question):
    with pytest.raises(CommandError, match="відповіді: keep_apart | merge"):
        run_catalog_sync("answer", str(merge_question.pk), "move", "--by", admin.username)


@pytest.mark.django_db
@pytest.mark.integration
def test_answer_refuses_a_change_that_is_not_a_question(
    run_catalog_sync, admin, make_catalog_run, make_title_change
):
    _, change = make_title_change(make_catalog_run())

    with pytest.raises(CommandError, match="лише на питання зіставлення"):
        run_catalog_sync("answer", str(change.pk), "keep", "--by", admin.username, "--yes")


@pytest.mark.django_db
@pytest.mark.integration
def test_answer_unrated_dry_run_counts_and_writes_nothing(run_catalog_sync, admin, merge_question):
    out = run_catalog_sync("answer", "--unrated", "keep_apart", "--by", admin.username)

    assert "Закрило б 1 питання без оцінок" in out
    assert not CatalogMappingDecision.objects.exists()


@pytest.mark.django_db
@pytest.mark.integration
def test_answer_unrated_yes_answers_every_unrated_question(run_catalog_sync, admin, merge_question):
    run_catalog_sync("answer", "--unrated", "keep_apart", "--by", admin.username, "--yes")

    decision = CatalogMappingDecision.objects.get()
    assert decision.question_key == merge_question.key
    assert decision.answer == MappingAnswer.KEEP_APART


@pytest.mark.django_db
@pytest.mark.integration
def test_answer_merge_refuses_a_course_outside_the_question(
    run_catalog_sync, admin, merge_question, course_factory
):
    outside = course_factory()

    with pytest.raises(CommandError, match="Оберіть дисципліну із запропонованих"):
        run_catalog_sync(
            "answer",
            str(merge_question.pk),
            "merge",
            "--into",
            str(outside.pk),
            "--by",
            admin.username,
            "--yes",
        )

    assert not CatalogMappingDecision.objects.exists()


@pytest.mark.django_db
@pytest.mark.integration
def test_answer_yes_logs_the_answer_and_a_dry_run_does_not(run_catalog_sync, admin, merge_question):
    args = ("answer", str(merge_question.pk), "keep_apart", "--by", admin.username)

    with capture_logs() as dry:
        run_catalog_sync(*args)
    with capture_logs() as written:
        run_catalog_sync(*args, "--yes")

    assert not [entry for entry in dry if entry["event"] == "sync_change_answered"]
    [entry] = [entry for entry in written if entry["event"] == "sync_change_answered"]
    assert entry["change_id"] == merge_question.pk
    assert entry["answer"] == "keep_apart"
    assert entry["user_id"] == admin.pk
