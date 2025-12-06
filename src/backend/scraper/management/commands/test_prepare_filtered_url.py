from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from django.core.management import call_command


@pytest.mark.django_db
class TestPrepareFilteredUrlCommand:
    """Unit tests for prepare_filtered_url management command."""

    @patch("scraper.management.commands.prepare_filtered_url.with_authenticated_context")
    @patch("scraper.management.commands.prepare_filtered_url.FilterService")
    def test_prepare_filtered_url_success(self, mock_filter_service, mock_auth_context):
        """Test prepare_filtered_url command successfully generates URL."""
        mock_filter_service_instance = MagicMock()
        mock_filter_service_instance.prepare_filtered_url = AsyncMock(
            return_value="https://example.com/filtered"
        )
        mock_filter_service.return_value = mock_filter_service_instance

        mock_decorated = AsyncMock(return_value="https://example.com/filtered")
        mock_auth_context.return_value = lambda func: mock_decorated

        call_command("prepare_filtered_url")

        mock_auth_context.assert_called_once()
        mock_decorated.assert_called_once()

    @patch("scraper.management.commands.prepare_filtered_url.with_authenticated_context")
    @patch("scraper.management.commands.prepare_filtered_url.FilterService")
    def test_prepare_filtered_url_interactive_mode(self, mock_filter_service, mock_auth_context):
        """Test prepare_filtered_url command in interactive mode."""
        mock_filter_service_instance = MagicMock()
        mock_filter_service_instance.prepare_filtered_url = AsyncMock(
            return_value="https://example.com/filtered"
        )
        mock_filter_service.return_value = mock_filter_service_instance

        mock_decorated = AsyncMock(return_value="https://example.com/filtered")
        mock_auth_context.return_value = lambda func: mock_decorated

        call_command("prepare_filtered_url", "--interactive")

        mock_auth_context.assert_called_once()
        call_args = mock_auth_context.call_args
        assert call_args.kwargs["headless"] is False

    @patch("scraper.management.commands.prepare_filtered_url.with_authenticated_context")
    @patch("scraper.management.commands.prepare_filtered_url.FilterService")
    def test_prepare_filtered_url_custom_output(self, mock_filter_service, mock_auth_context):
        """Test prepare_filtered_url command with custom output path."""
        mock_filter_service_instance = MagicMock()
        mock_filter_service_instance.prepare_filtered_url = AsyncMock(
            return_value="https://example.com/filtered"
        )
        mock_filter_service.return_value = mock_filter_service_instance

        mock_decorated = AsyncMock(return_value="https://example.com/filtered")
        mock_auth_context.return_value = lambda func: mock_decorated

        call_command("prepare_filtered_url", "--out", "/custom/path.txt")

        mock_auth_context.assert_called_once()
        mock_decorated.assert_called_once()
