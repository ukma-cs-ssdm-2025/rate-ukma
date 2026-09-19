import decimal

import pytest

from rating_app.management.commands.profile_queries import credits_range_payload
from rating_app.tests.factories import (
    CourseOfferingFactory,
    CourseOfferingTermFactory,
    SemesterFactory,
)


@pytest.mark.django_db
def test_credits_range_omitted_for_termless_offering():
    offering = CourseOfferingFactory()

    assert credits_range_payload(offering) == {}


@pytest.mark.django_db
def test_credits_range_sums_terms():
    semester = SemesterFactory()
    offering = CourseOfferingFactory(semester=semester)
    CourseOfferingTermFactory(offering=offering, semester=semester, credits=decimal.Decimal("3.0"))
    other_semester = SemesterFactory()
    CourseOfferingTermFactory(
        offering=offering, semester=other_semester, credits=decimal.Decimal("4.0")
    )

    assert credits_range_payload(offering) == {
        "credits_min": decimal.Decimal("7.0"),
        "credits_max": decimal.Decimal("7.0"),
    }
