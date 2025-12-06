from unittest.mock import MagicMock, patch

import pytest

from django.core.management import call_command


@pytest.mark.django_db
@patch("scraper.management.commands.insert_scraped.courses_ingestion")
def test_insert_scraped_success(mock_ingestion):
    # Arrange
    mock_operation = MagicMock()
    mock_ingestion.return_value = mock_operation

    # Act
    call_command("insert_scraped", "--file", "courses.jsonl")

    # Assert
    mock_ingestion.assert_called_once()
    mock_operation.execute.assert_called_once()


@pytest.mark.django_db
@patch("scraper.management.commands.insert_scraped.courses_ingestion")
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


@pytest.mark.django_db
@patch("scraper.management.commands.insert_scraped.courses_ingestion")
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
