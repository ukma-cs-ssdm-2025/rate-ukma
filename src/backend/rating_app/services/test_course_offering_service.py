from unittest.mock import MagicMock

import pytest

from rating_app.services.course_offering_service import CourseOfferingService


@pytest.fixture
def offering_repo():
    return MagicMock()


@pytest.fixture
def service(offering_repo):
    return CourseOfferingService(course_offering_repository=offering_repo)


def test_list_course_offerings_returns_all_offerings_from_repository(service, offering_repo):
    expected_offerings = [MagicMock(), MagicMock()]
    offering_repo.get_all.return_value = expected_offerings

    result = service.list_course_offerings()

    assert result == expected_offerings
    offering_repo.get_all.assert_called_once()


def test_get_course_offering_returns_offering_by_id(service, offering_repo):
    offering_id = "offering-123"
    expected_offering = MagicMock()
    offering_repo.get_by_id.return_value = expected_offering

    result = service.get_course_offering(offering_id)

    assert result == expected_offering
    offering_repo.get_by_id.assert_called_once_with(offering_id)


def test_get_course_offerings_by_course_returns_offerings_for_course(service, offering_repo):
    course_id = "course-123"
    expected_offerings = [MagicMock(), MagicMock()]
    offering_repo.get_by_course.return_value = expected_offerings

    result = service.get_course_offerings_by_course(course_id)

    assert result == expected_offerings
    offering_repo.get_by_course.assert_called_once_with(course_id)
