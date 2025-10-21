import pytest

from rating_app.repositories.course_repository import CourseRepository
from rating_app.tests.factories import (
    CourseFactory,
    CourseInstructorFactory,
    CourseOfferingFactory,
    InstructorFactory,
)


@pytest.mark.django_db
def test_filter_by_instructor_returns_only_assigned_courses():
    repo = CourseRepository()

    instructor = InstructorFactory()
    course_with_instructor = CourseFactory()
    offering_with_instructor = CourseOfferingFactory(course=course_with_instructor)
    CourseInstructorFactory(course_offering=offering_with_instructor, instructor=instructor)

    course_without_instructor = CourseFactory()
    CourseOfferingFactory(course=course_without_instructor)

    result = repo.filter(instructor=str(instructor.id))

    returned_ids = {course.id for course in result["items"]}

    assert returned_ids == {course_with_instructor.id}
