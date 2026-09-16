from django.core.management import call_command

import pytest

from rating_app.management.commands.prune_legacy_specialities import (
    get_current_academic_year_start,
)
from rating_app.models import CourseOfferingSpeciality, Speciality
from rating_app.models.choices import SemesterTerm
from rating_app.tests.factories import (
    CourseOfferingFactory,
    CourseOfferingSpecialityFactory,
    SemesterFactory,
    SpecialityFactory,
    StudentFactory,
)


def _old_semester():
    start = get_current_academic_year_start()
    return SemesterFactory(year=start - 3, term=SemesterTerm.FALL)


def _recent_semester():
    start = get_current_academic_year_start()
    return SemesterFactory(year=start, term=SemesterTerm.FALL)


@pytest.mark.django_db
def test_dry_run_by_default_deletes_nothing():
    spec = SpecialityFactory()
    CourseOfferingSpecialityFactory(
        offering=CourseOfferingFactory(semester=_old_semester()),
        speciality=spec,
    )
    before = Speciality.objects.count()

    call_command("prune_legacy_specialities")

    assert Speciality.objects.count() == before
    assert Speciality.objects.filter(pk=spec.pk).exists()


@pytest.mark.django_db
def test_apply_deletes_speciality_with_no_students_and_only_old_offerings():
    spec = SpecialityFactory()
    CourseOfferingSpecialityFactory(
        offering=CourseOfferingFactory(semester=_old_semester()),
        speciality=spec,
    )

    call_command("prune_legacy_specialities", "--apply")

    assert not Speciality.objects.filter(pk=spec.pk).exists()
    assert CourseOfferingSpeciality.objects.filter(speciality_id=spec.pk).count() == 0


@pytest.mark.django_db
def test_apply_deletes_speciality_with_no_offerings_at_all():
    spec = SpecialityFactory()

    call_command("prune_legacy_specialities", "--apply")

    assert not Speciality.objects.filter(pk=spec.pk).exists()


@pytest.mark.django_db
def test_keeps_speciality_with_students():
    spec = SpecialityFactory()
    StudentFactory(speciality=spec)
    CourseOfferingSpecialityFactory(
        offering=CourseOfferingFactory(semester=_old_semester()),
        speciality=spec,
    )

    call_command("prune_legacy_specialities", "--apply")

    assert Speciality.objects.filter(pk=spec.pk).exists()


@pytest.mark.django_db
def test_keeps_speciality_with_recent_offering():
    spec = SpecialityFactory()
    CourseOfferingSpecialityFactory(
        offering=CourseOfferingFactory(semester=_recent_semester()),
        speciality=spec,
    )

    call_command("prune_legacy_specialities", "--apply")

    assert Speciality.objects.filter(pk=spec.pk).exists()


@pytest.mark.django_db
def test_apply_is_idempotent():
    spec = SpecialityFactory()
    CourseOfferingSpecialityFactory(
        offering=CourseOfferingFactory(semester=_old_semester()),
        speciality=spec,
    )

    call_command("prune_legacy_specialities", "--apply")
    assert not Speciality.objects.filter(pk=spec.pk).exists()

    call_command("prune_legacy_specialities", "--apply")
    assert not Speciality.objects.filter(pk=spec.pk).exists()
