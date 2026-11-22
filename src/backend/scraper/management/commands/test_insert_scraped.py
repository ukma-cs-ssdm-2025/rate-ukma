from contextlib import contextmanager
from unittest.mock import MagicMock, patch

from django.core.management import call_command
from django.core.management.base import CommandError

import pytest

from scraper.services.db_ingestion.injector import CatalogWritesRefusedError

COMMAND = "scraper.management.commands.insert_scraped"


@contextmanager
def lock_free(_key):
    yield True


@contextmanager
def lock_held_elsewhere(_key):
    yield False


@pytest.fixture(autouse=True)
def free_lock():
    with patch(f"{COMMAND}.advisory_lock", lock_free):
        yield


@patch(f"{COMMAND}.courses_ingestion")
def test_insert_scraped_success(mock_ingestion):
    # Arrange
    mock_operation = MagicMock()
    mock_ingestion.return_value = mock_operation

    # Act
    call_command("insert_scraped", "--file", "courses.jsonl")

    # Assert
    mock_ingestion.assert_called_once()
    mock_operation.execute.assert_called_once()


@patch(f"{COMMAND}.courses_ingestion")
def test_insert_scraped_with_batch_size(mock_ingestion):
    # Arrange
    mock_operation = MagicMock()
    mock_ingestion.return_value = mock_operation

    # Act
    call_command("insert_scraped", "--file", "courses.jsonl", "--batch-size", "50")

    # Assert
    mock_ingestion.assert_called_once()
    mock_operation.execute.assert_called_once()
    call_args = mock_operation.execute.call_args
    assert call_args.kwargs["batch_size"] == 50


@patch(f"{COMMAND}.courses_ingestion")
def test_insert_scraped_dry_run(mock_ingestion):
    # Arrange
    mock_operation = MagicMock()
    mock_ingestion.return_value = mock_operation

    # Act
    call_command("insert_scraped", "--file", "courses.jsonl", "--dry-run")

    # Assert
    mock_ingestion.assert_called_once()
    mock_operation.execute.assert_called_once()
    call_args = mock_operation.execute.call_args
    assert call_args.kwargs["dry_run"] is True


@patch(f"{COMMAND}.courses_ingestion")
def test_insert_scraped_enrollments_only_switches_the_injector(mock_ingestion):
    mock_operation = MagicMock()
    mock_ingestion.return_value = mock_operation

    call_command("insert_scraped", "--file", "courses.jsonl", "--enrollments-only")

    assert mock_operation.db_injector.enrollments_only is True


@patch(f"{COMMAND}.courses_ingestion")
def test_insert_scraped_without_the_flag_writes_catalog_rows(mock_ingestion):
    mock_operation = MagicMock()
    mock_ingestion.return_value = mock_operation

    call_command("insert_scraped", "--file", "courses.jsonl")

    assert mock_operation.db_injector.enrollments_only is False


@patch(f"{COMMAND}.courses_ingestion")
def test_insert_scraped_refuses_while_a_catalog_sync_holds_the_lock(mock_ingestion):
    with patch(f"{COMMAND}.advisory_lock", lock_held_elsewhere):
        with pytest.raises(CommandError, match="another catalog sync is running"):
            call_command("insert_scraped", "--file", "courses.jsonl")

    mock_ingestion.return_value.execute.assert_not_called()


@patch(f"{COMMAND}.courses_ingestion")
def test_insert_scraped_explains_the_enrollments_only_mode_on_a_linked_catalog(mock_ingestion):
    mock_operation = MagicMock()
    mock_operation.execute.side_effect = CatalogWritesRefusedError("linked")
    mock_ingestion.return_value = mock_operation

    with pytest.raises(CommandError, match="use --enrollments-only"):
        call_command("insert_scraped", "--file", "courses.jsonl")
