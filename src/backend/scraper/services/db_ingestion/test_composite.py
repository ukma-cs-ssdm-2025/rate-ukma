from unittest.mock import MagicMock

import pytest

from rating_app.models import Speciality
from rating_app.tests.factories import SpecialityFactory
from scraper.services.db_ingestion.composite import CoursesIngestion


@pytest.mark.django_db
def test_execute_prunes_legacy_specialities_after_ingest(tmp_path):
    legacy = SpecialityFactory()
    assert Speciality.objects.filter(pk=legacy.pk).exists()

    data_file = tmp_path / "courses.jsonl"
    data_file.write_text("", encoding="utf-8")
    file_reader = MagicMock()
    file_reader.provide.return_value = iter([[]])
    db_injector = MagicMock(spec=["execute", "reset_state", "set_batch_number"])

    CoursesIngestion(file_reader=file_reader, db_injector=db_injector).execute(
        file_path=data_file, batch_size=100, dry_run=False
    )

    assert not Speciality.objects.filter(pk=legacy.pk).exists()


@pytest.mark.django_db
def test_execute_dry_run_does_not_prune(tmp_path):
    legacy = SpecialityFactory()

    data_file = tmp_path / "courses.jsonl"
    data_file.write_text("", encoding="utf-8")
    file_reader = MagicMock()
    file_reader.provide.return_value = iter([[]])
    db_injector = MagicMock(spec=["execute", "reset_state", "set_batch_number"])

    CoursesIngestion(file_reader=file_reader, db_injector=db_injector).execute(
        file_path=data_file, batch_size=100, dry_run=True
    )

    assert Speciality.objects.filter(pk=legacy.pk).exists()
