from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from django.core.management import call_command


@pytest.mark.django_db
@patch("scraper.management.commands.collect_catalog.with_authenticated_context")
@patch("scraper.management.commands.collect_catalog.FilterService")
def test_collect_catalog_with_default_url(mock_filter_service, mock_auth_context):
    # Arrange
    mock_filter_service_instance = MagicMock()
    mock_filter_service_instance.load_filtered_url = AsyncMock(return_value=None)
    mock_filter_service.return_value = mock_filter_service_instance

    mock_decorated = AsyncMock()
    mock_auth_context.return_value = lambda func: mock_decorated

    # Act
    call_command("collect_catalog", "--start-page", "1", "--end-page", "2")

    # Assert
    mock_auth_context.assert_called_once()
    mock_decorated.assert_called_once()


@pytest.mark.django_db
@patch("scraper.management.commands.collect_catalog.with_authenticated_context")
@patch("scraper.management.commands.collect_catalog.FilterService")
def test_collect_catalog_with_custom_url(mock_filter_service, mock_auth_context):
    # Arrange
    custom_url = "https://example.com/catalog"
    mock_decorated = AsyncMock()
    mock_auth_context.return_value = lambda func: mock_decorated

    # Act
    call_command(
        "collect_catalog",
        "--url",
        custom_url,
        "--start-page",
        "1",
        "--end-page",
        "2",
    )

    # Assert
    mock_auth_context.assert_called_once()
    mock_decorated.assert_called_once()
    mock_filter_service.assert_not_called()


@pytest.mark.django_db
@patch("scraper.management.commands.collect_catalog.with_authenticated_context")
@patch("scraper.management.commands.collect_catalog.FilterService")
def test_collect_catalog_with_filtered_url(mock_filter_service, mock_auth_context):
    # Arrange
    filtered_url = "https://example.com/filtered"
    mock_filter_service_instance = MagicMock()
    mock_filter_service_instance.load_filtered_url = AsyncMock(return_value=filtered_url)
    mock_filter_service.return_value = mock_filter_service_instance

    mock_decorated = AsyncMock()
    mock_auth_context.return_value = lambda func: mock_decorated

    # Act
    call_command("collect_catalog", "--start-page", "1")

    # Assert
    mock_auth_context.assert_called_once()
    mock_decorated.assert_called_once()
    mock_filter_service_instance.load_filtered_url.assert_called_once()
