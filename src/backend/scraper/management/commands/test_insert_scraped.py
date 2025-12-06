from unittest.mock import MagicMock, patch

import pytest

from django.core.management import call_command


@pytest.mark.django_db
class TestInsertScrapedCommand:
    """Unit tests for insert_scraped management command."""

    @patch("scraper.management.commands.insert_scraped.courses_ingestion")
    def test_insert_scraped_success(self, mock_ingestion):
        """Test insert_scraped command with valid file."""
        mock_operation = MagicMock()
        mock_ingestion.return_value = mock_operation

        call_command("insert_scraped", "--file", "courses.jsonl")

        mock_ingestion.assert_called_once()
        mock_operation.execute.assert_called_once()

    @patch("scraper.management.commands.insert_scraped.courses_ingestion")
    def test_insert_scraped_with_batch_size(self, mock_ingestion):
        """Test insert_scraped command with custom batch size."""
        mock_operation = MagicMock()
        mock_ingestion.return_value = mock_operation

        call_command("insert_scraped", "--file", "courses.jsonl", "--batch-size", "50")

        mock_ingestion.assert_called_once()
        mock_operation.execute.assert_called_once()
        call_args = mock_operation.execute.call_args
        assert call_args.kwargs["batch_size"] == 50

    @patch("scraper.management.commands.insert_scraped.courses_ingestion")
    def test_insert_scraped_dry_run(self, mock_ingestion):
        """Test insert_scraped command in dry-run mode."""
        mock_operation = MagicMock()
        mock_ingestion.return_value = mock_operation

        call_command("insert_scraped", "--file", "courses.jsonl", "--dry-run")

        mock_ingestion.assert_called_once()
        mock_operation.execute.assert_called_once()
        call_args = mock_operation.execute.call_args
        assert call_args.kwargs["dry_run"] is True
