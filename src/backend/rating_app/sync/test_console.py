from __future__ import annotations

import pytest

from rating_app.sync import console
from rating_app.sync.decisions import DecisionResult


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
