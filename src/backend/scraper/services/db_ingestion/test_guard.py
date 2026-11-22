"""The guard that stops the old scraper writing a catalog the sync already linked."""

import pytest

from scraper.services.db_ingestion.injector import catalog_linked


@pytest.mark.django_db
def test_no_row_is_linked_on_a_scraper_only_catalog():
    assert catalog_linked() is False


@pytest.mark.django_db
def test_a_linked_offering_stops_catalog_writes(course_offering_factory):
    course_offering_factory(ukma_data_id="ud-offering")

    assert catalog_linked() is True
