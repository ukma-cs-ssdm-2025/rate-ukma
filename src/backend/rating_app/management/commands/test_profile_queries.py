import decimal

import pytest

from rating_app.management.commands.profile_queries import credits_range_payload


@pytest.mark.django_db
@pytest.mark.integration
def test_credits_range_omitted_for_termless_offering(course_offering_factory):
    offering = course_offering_factory()

    assert credits_range_payload(offering) == {}


@pytest.mark.django_db
@pytest.mark.integration
def test_credits_range_sums_terms(
    semester_factory, course_offering_factory, course_offering_term_factory
):
    semester = semester_factory()
    offering = course_offering_factory(semester=semester)
    course_offering_term_factory(
        offering=offering, semester=semester, credits=decimal.Decimal("3.0")
    )
    other_semester = semester_factory()
    course_offering_term_factory(
        offering=offering, semester=other_semester, credits=decimal.Decimal("4.0")
    )

    assert credits_range_payload(offering) == {
        "credits_min": decimal.Decimal("7.0"),
        "credits_max": decimal.Decimal("7.0"),
    }
