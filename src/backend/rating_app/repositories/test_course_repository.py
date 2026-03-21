import pytest

from rating_app.application_schemas.course import CourseInput
from rating_app.application_schemas.course import CourseFilterCriteriaInternal
from rating_app.models import Course
from rating_app.models.choices import CourseStatus, EducationLevel, SemesterTerm
from rating_app.pagination import GenericQuerysetPaginator
from rating_app.repositories.course_repository import CourseRepository
from rating_app.repositories.to_domain_mappers import CourseMapper
from rating_app.tests.factories import (
    CourseFactory,
    CourseInstructorFactory,
    CourseOfferingFactory,
    InstructorFactory,
    SemesterFactory,
)


@pytest.fixture
def repo():
    return CourseRepository(mapper=CourseMapper(), paginator=GenericQuerysetPaginator[Course]())


@pytest.mark.django_db
@pytest.mark.integration
def test_filter_by_instructor_returns_only_assigned_courses(repo):
    # Arrange
    instructor = InstructorFactory()
    course_with_instructor = CourseFactory()
    offering_with_instructor = CourseOfferingFactory(course=course_with_instructor)
    CourseInstructorFactory(course_offering=offering_with_instructor, instructor=instructor)

    # Act
    course_without_instructor = CourseFactory()
    CourseOfferingFactory(course=course_without_instructor)
    filters = CourseFilterCriteriaInternal(instructor=instructor.id)
    result = repo.filter(filters)

    # Assert
    returned_ids = {course.id for course in result}
    assert returned_ids == {str(course_with_instructor.id)}
    assert len(result) == 1
    assert result[0].title == course_with_instructor.title


@pytest.mark.django_db
@pytest.mark.integration
def test_filter_by_semester_limits_to_matching_courses(repo):
    # Arrange
    fall_semester = SemesterFactory(term=SemesterTerm.FALL, year=2024)
    spring_semester = SemesterFactory(term=SemesterTerm.SPRING, year=2025)

    fall_course = CourseFactory(title="Autumn Course")
    CourseOfferingFactory(course=fall_course, semester=fall_semester)

    spring_course = CourseFactory(title="Spring Course")
    CourseOfferingFactory(course=spring_course, semester=spring_semester)

    # Act - Use academic year format "2024–2025" which includes Fall 2024 and Spring 2025
    result = repo.filter(
        CourseFilterCriteriaInternal(
            semester_year="2024–2025",
            semester_terms=[fall_semester.term],
        )
    )

    # Assert
    returned_ids = {course.id for course in result}
    assert returned_ids == {str(fall_course.id)}
    assert len(result) == 1
    assert result[0].title == "Autumn Course"


@pytest.mark.django_db
@pytest.mark.integration
def test_filter_by_credits_range_and_semester_year_uses_same_offering(repo):
    # Arrange
    target_semester = SemesterFactory(term=SemesterTerm.FALL, year=2024)
    other_semester = SemesterFactory(term=SemesterTerm.FALL, year=2023)

    matching_course = CourseFactory(title="Matching course")
    CourseOfferingFactory(
        course=matching_course,
        semester=target_semester,
        credits=4.0,
    )

    mismatched_course = CourseFactory(title="Mismatched course")
    CourseOfferingFactory(
        course=mismatched_course,
        semester=target_semester,
        credits=3.0,
    )
    CourseOfferingFactory(
        course=mismatched_course,
        semester=other_semester,
        credits=4.0,
    )

    # Act
    result = repo.filter(
        CourseFilterCriteriaInternal(
            semester_year="2024–2025",
            credits_min=3.5,
            credits_max=4.5,
        )
    )

    # Assert
    returned_ids = {course.id for course in result}
    assert returned_ids == {str(matching_course.id)}
    assert len(result) == 1


@pytest.mark.django_db
@pytest.mark.integration
def test_filter_returns_domain_models(repo):
    # Arrange
    course = CourseFactory()
    CourseOfferingFactory(course=course)

    # Act
    result = repo.filter(CourseFilterCriteriaInternal())

    # Assert
    assert len(result) >= 1

    found_course = next((c for c in result if c.id == str(course.id)), None)
    assert found_course is not None
    assert found_course.title == course.title
    assert isinstance(found_course.specialities, list)


@pytest.mark.django_db
@pytest.mark.integration
def test_filter_prefetches_only_relations_needed_for_course_mapping(
    django_assert_num_queries, repo
):
    # Arrange
    semester = SemesterFactory()
    for _ in range(3):
        CourseOfferingFactory(semester=semester, instructors=[InstructorFactory()])

    # Assert
    # 1) base courses + department/faculty
    # 2) offerings
    # 3) course_offering_specialities joined with speciality + faculty
    with django_assert_num_queries(3):
        repo.filter(CourseFilterCriteriaInternal())


@pytest.mark.django_db
@pytest.mark.integration
def test_get_or_create_keeps_bachelor_and_master_courses_separate(repo):
    department = CourseFactory().department

    bachelor_input = CourseInput(
        title="Data Science",
        description="Bachelor version",
        status=CourseStatus.ACTIVE,
        education_level=EducationLevel.BACHELOR,
        department=str(department.id),
        department_name=department.name,
        faculty=str(department.faculty_id),
        faculty_name=department.faculty.name,
    )
    master_input = CourseInput(
        title="Data Science",
        description="Master version",
        status=CourseStatus.ACTIVE,
        education_level=EducationLevel.MASTER,
        department=str(department.id),
        department_name=department.name,
        faculty=str(department.faculty_id),
        faculty_name=department.faculty.name,
    )

    bachelor_course, bachelor_created = repo.get_or_create(bachelor_input)
    master_course, master_created = repo.get_or_create(master_input)

    assert bachelor_created is True
    assert master_created is True
    assert bachelor_course.id != master_course.id
    assert bachelor_course.education_level == EducationLevel.BACHELOR
    assert master_course.education_level == EducationLevel.MASTER


@pytest.mark.django_db
@pytest.mark.integration
def test_get_or_create_does_not_update_existing_course_fields(repo):
    department = CourseFactory().department

    course_input = CourseInput(
        title="Data Science",
        description="Original description",
        status=CourseStatus.ACTIVE,
        education_level=EducationLevel.BACHELOR,
        department=str(department.id),
        department_name=department.name,
        faculty=str(department.faculty_id),
        faculty_name=department.faculty.name,
    )
    original, created = repo.get_or_create(course_input)
    assert created is True

    updated_input = CourseInput(
        title="Data Science",
        description="Updated description",
        status=CourseStatus.FINISHED,
        education_level=EducationLevel.BACHELOR,
        department=str(department.id),
        department_name=department.name,
        faculty=str(department.faculty_id),
        faculty_name=department.faculty.name,
    )
    found, created = repo.get_or_create(updated_input)

    assert created is False
    assert found.id == original.id
    refreshed = Course.objects.get(id=original.id)
    assert refreshed.description == "Original description"
    assert refreshed.status == CourseStatus.ACTIVE


@pytest.mark.django_db
@pytest.mark.integration
def test_course_mapper_normalizes_empty_education_level_to_none():
    course = CourseFactory(education_level="")
    mapper = CourseMapper()
    result = mapper.process(course)
    assert result.education_level is None


@pytest.mark.django_db
@pytest.mark.integration
def test_get_or_upsert_reuses_legacy_blank_level_course(repo):
    legacy_course = CourseFactory(
        title="Data Science",
        education_level="",
    )
    department = legacy_course.department

    bachelor_input = CourseInput(
        title="Data Science",
        description="Bachelor version",
        status=CourseStatus.ACTIVE,
        education_level=EducationLevel.BACHELOR,
        department=str(department.id),
        department_name=department.name,
        faculty=str(department.faculty_id),
        faculty_name=department.faculty.name,
    )

    course, created = repo.get_or_upsert(bachelor_input)

    legacy_course.refresh_from_db()
    assert created is False
    assert course.id == str(legacy_course.id)
    assert course.education_level == EducationLevel.BACHELOR
    assert legacy_course.education_level == EducationLevel.BACHELOR
