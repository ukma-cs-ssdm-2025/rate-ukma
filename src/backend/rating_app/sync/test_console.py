from __future__ import annotations

from django.utils import timezone

import pytest

from rating_app.sync import console
from rating_app.sync.decisions import DecisionResult
from rating_app.sync.journal import JournalEntry


def _moved(*, dry_run: bool) -> DecisionResult:
    return DecisionResult(
        action="apply",
        outcome="applied",
        dry_run=dry_run,
        approval_id=None if dry_run else 7,
        error="",
        counts={},
        ratings_moved=3,
        plans_moved=1,
    )


@pytest.mark.parametrize(
    ("dry_run", "verb"), [(True, "Перенесе 3 оцінки"), (False, "Перенесено 3 оцінки")]
)
def test_decision_lines_say_moved_ratings_in_the_right_tense(dry_run, verb):
    lines = console.decision_lines(_moved(dry_run=dry_run), limit=20)

    assert any(line.startswith(verb) for line in lines)


@pytest.mark.parametrize(
    ("count", "words"), [(1, "1 рішення"), (3, "3 рішення"), (5, "5 рішень"), (21, "21 рішення")]
)
def test_decisions_word_agrees_with_the_count(count, words):
    assert console.decisions_word(count) == words


@pytest.mark.parametrize(
    ("action", "summary"),
    [
        ("decide_case", "Рішення в UKMA Data: та сама людина"),
        ("merge_course", "Рішення в UKMA Data: об'єднано"),
        ("unmerge_course", "Рішення в UKMA Data: роз'єднано"),
    ],
)
def test_decision_journal_lines_name_the_action(action, summary):
    entry = JournalEntry(
        id=1,
        kind="decision",
        who="admin.test",
        when=timezone.now(),
        counts={"action": action, "target_id": "c-101", "related_id": None},
        outcome="done",
    )

    assert console.journal_summary(entry) == summary
    assert summary in console.journal_line(entry)


def test_a_refused_decision_journal_line_keeps_the_reason():
    entry = JournalEntry(
        id=2,
        kind="decision",
        who="admin.test",
        when=timezone.now(),
        counts={"action": "merge_course", "target_id": "c-101", "related_id": "c-102"},
        outcome="refused",
        error="level_mismatch",
    )

    assert (
        console.journal_summary(entry) == "Рішення в UKMA Data: об'єднано — відмова: level_mismatch"
    )
