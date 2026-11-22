from __future__ import annotations

from django.core.management.base import CommandError

import pytest

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

    assert "Позначило б «лишити окремо» 1 питань" in out
    assert not CatalogMappingDecision.objects.exists()


@pytest.mark.django_db
@pytest.mark.integration
def test_answer_unrated_yes_answers_every_unrated_question(run_catalog_sync, admin, merge_question):
    run_catalog_sync("answer", "--unrated", "keep_apart", "--by", admin.username, "--yes")

    decision = CatalogMappingDecision.objects.get()
    assert decision.question_key == merge_question.key
    assert decision.answer == MappingAnswer.KEEP_APART
