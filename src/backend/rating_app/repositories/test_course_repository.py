import pytest

from rating_app.application_schemas.course import CourseFilterCriteriaInternal, CourseInput
from rating_app.models import Course
from rating_app.models.choices import CourseStatus, EducationLevel, SemesterTerm
from rating_app.pagination import GenericQuerysetPaginator, PaginationFilters
from rating_app.repositories.course_repository import CourseRepository
from rating_app.repositories.to_domain_mappers import CourseMapper


@pytest.fixture
def repo():
    return CourseRepository(mapper=CourseMapper(), paginator=GenericQuerysetPaginator[Course]())


@pytest.mark.django_db
@pytest.mark.integration
def test_filter_by_instructor_returns_mentioned_courses(
    repo, instructor_factory, course_factory, course_offering_factory, rating_factory
):
    # Arrange — instructor mentioned in a rating, with NO CourseInstructor
    # assignment row (assignments are unpopulated in real data; mentions are
    # the signal). Regression test for #664.
    instructor = instructor_factory()
    course_with_mention = course_factory()
    offering_with_mention = course_offering_factory(course=course_with_mention)
    rating = rating_factory(course_offering=offering_with_mention)
    rating.instructors.add(instructor)

    # Act
    course_without_mention = course_factory()
    course_offering_factory(course=course_without_mention)
    filters = CourseFilterCriteriaInternal(instructor=instructor.id)
    result = repo.filter(filters)

    # Assert
    returned_ids = {course.id for course in result}
    assert returned_ids == {str(course_with_mention.id)}
    assert len(result) == 1
    assert result[0].title == course_with_mention.title


@pytest.mark.django_db
@pytest.mark.integration
def test_filter_by_instructor_with_zero_mentions_returns_empty(
    repo, instructor_factory, course_offering_factory
):
    # An instructor nobody mentioned matches nothing, even when offerings exist.
    instructor = instructor_factory()
    course_offering_factory()

    result = repo.filter(CourseFilterCriteriaInternal(instructor=instructor.id))

    assert result == []


@pytest.mark.django_db
@pytest.mark.integration
def test_filter_by_instructor_combined_with_department(
    repo, instructor_factory, course_factory, course_offering_factory, rating_factory
):
    # Mention on a course in another department must not leak through the
    # combined filter.
    instructor = instructor_factory()
    wanted = course_factory()
    wanted_offering = course_offering_factory(course=wanted)
    wanted_rating = rating_factory(course_offering=wanted_offering)
    wanted_rating.instructors.add(instructor)

    other = course_factory()
    other_offering = course_offering_factory(course=other)
    other_rating = rating_factory(course_offering=other_offering)
    other_rating.instructors.add(instructor)

    filters = CourseFilterCriteriaInternal(
        instructor=instructor.id, department=str(wanted.department_id)
    )
    result = repo.filter(filters)

    assert {course.id for course in result} == {str(wanted.id)}


@pytest.mark.django_db
@pytest.mark.integration
def test_filter_by_instructor_combined_with_education_level(
    repo, instructor_factory, course_factory, course_offering_factory, rating_factory
):
    # Mention on a bachelor course must not leak into a master-scoped
    # instructor query.
    instructor = instructor_factory()
    wanted = course_factory(education_level=EducationLevel.MASTER)
    wanted_offering = course_offering_factory(course=wanted)
    wanted_rating = rating_factory(course_offering=wanted_offering)
    wanted_rating.instructors.add(instructor)

    other = course_factory(education_level=EducationLevel.BACHELOR)
    other_offering = course_offering_factory(course=other)
    other_rating = rating_factory(course_offering=other_offering)
    other_rating.instructors.add(instructor)

    filters = CourseFilterCriteriaInternal(
        instructor=instructor.id, education_level=EducationLevel.MASTER
    )
    result = repo.filter(filters)

    assert {course.id for course in result} == {str(wanted.id)}


@pytest.mark.django_db
@pytest.mark.integration
def test_filter_by_instructor_pagination_edge_clamps_to_last_page(
    repo, instructor_factory, course_offering_factory, rating_factory
):
    # One mentioned course; asking for page 2 clamps to page 1 (Django
    # get_page) without error or leaking rows.
    instructor = instructor_factory()
    offering = course_offering_factory()
    rating = rating_factory(course_offering=offering)
    rating.instructors.add(instructor)

    filters = CourseFilterCriteriaInternal(instructor=instructor.id)
    result = repo.filter(filters, PaginationFilters(page=2, page_size=1))

    assert result.metadata.total == 1
    assert result.metadata.page == 1
    assert len(result.page_objects) == 1


@pytest.mark.django_db
@pytest.mark.integration
def test_filter_by_education_level_returns_correct_courses(repo, course_factory):
    # Arrange
    master_course = course_factory(education_level=EducationLevel.MASTER)
    _bachelor_course = course_factory(education_level=EducationLevel.BACHELOR)

    # Act
    filters = CourseFilterCriteriaInternal(education_level=EducationLevel.MASTER)
    result = repo.filter(filters)

    # Assert
    assert len(result) == 1
    returned_ids = {course.id for course in result}
    assert returned_ids == {str(master_course.id)}
    assert result[0].title == master_course.title


@pytest.mark.django_db
@pytest.mark.integration
def test_filter_by_semester_limits_to_matching_courses(
    repo, semester_factory, course_factory, course_offering_factory
):
    # Arrange
    fall_semester = semester_factory(term=SemesterTerm.FALL, year=2024)
    spring_semester = semester_factory(term=SemesterTerm.SPRING, year=2025)

    fall_course = course_factory(title="Autumn Course")
    course_offering_factory(course=fall_course, semester=fall_semester)

    spring_course = course_factory(title="Spring Course")
    course_offering_factory(course=spring_course, semester=spring_semester)

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
def test_filter_by_credits_range_and_semester_year_uses_same_offering(
    repo, semester_factory, course_factory, course_offering_factory
):
    # Arrange
    target_semester = semester_factory(term=SemesterTerm.FALL, year=2024)
    other_semester = semester_factory(term=SemesterTerm.FALL, year=2023)

    matching_course = course_factory(title="Matching course")
    course_offering_factory(
        course=matching_course,
        semester=target_semester,
        credits=4.0,
    )

    mismatched_course = course_factory(title="Mismatched course")
    course_offering_factory(
        course=mismatched_course,
        semester=target_semester,
        credits=3.0,
    )
    course_offering_factory(
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
def test_filter_returns_domain_models(repo, course_factory, course_offering_factory):
    # Arrange
    course = course_factory()
    course_offering_factory(course=course)

    # Act
    result = repo.filter(CourseFilterCriteriaInternal())

    # Assert
    assert len(result) >= 1

    found_course = next((c for c in result if c.id == str(course.id)), None)
    assert found_course is not None
    assert found_course.title == course.title
    assert isinstance(found_course.specialities, list)


@pytest.fixture
def five_courses_out_of_order(course_factory):
    # Insertion order differs from the alphabetical order the repository must apply.
    return [course_factory(title=f"Course {letter}") for letter in "DBEAC"]


@pytest.mark.django_db
@pytest.mark.integration
def test_filter_without_pagination_returns_plain_list_of_all_matching_courses(
    repo, five_courses_out_of_order
):
    # Act
    result = repo.filter(CourseFilterCriteriaInternal())

    # Assert
    assert isinstance(result, list)
    assert [c.title for c in result] == [
        "Course A",
        "Course B",
        "Course C",
        "Course D",
        "Course E",
    ]


@pytest.mark.django_db
@pytest.mark.integration
def test_filter_with_pagination_returns_first_page_and_metadata(repo, five_courses_out_of_order):
    # Act
    result = repo.filter(CourseFilterCriteriaInternal(), PaginationFilters(page=1, page_size=2))

    # Assert
    assert [c.title for c in result.page_objects] == ["Course A", "Course B"]
    assert result.metadata.total == 5
    assert result.metadata.total_pages == 3
    assert result.metadata.page == 1
    assert result.metadata.page_size == 2


@pytest.mark.django_db
@pytest.mark.integration
def test_filter_with_pagination_last_page_returns_remaining_courses(
    repo, five_courses_out_of_order
):
    # Act
    result = repo.filter(CourseFilterCriteriaInternal(), PaginationFilters(page=3, page_size=2))

    # Assert
    assert [c.title for c in result.page_objects] == ["Course E"]
    assert result.metadata.page == 3
    assert result.metadata.total_pages == 3


@pytest.mark.django_db
@pytest.mark.integration
def test_filter_with_pagination_page_beyond_range_clamps_to_last_page(
    repo, five_courses_out_of_order
):
    # Act
    result = repo.filter(CourseFilterCriteriaInternal(), PaginationFilters(page=99, page_size=2))

    # Assert
    assert [c.title for c in result.page_objects] == ["Course E"]
    assert result.metadata.page == 3
    assert result.metadata.total_pages == 3
    assert result.metadata.total == 5


@pytest.mark.django_db
@pytest.mark.integration
def test_filter_prefetches_only_relations_needed_for_course_mapping(
    django_assert_num_queries, repo, semester_factory, course_offering_factory, instructor_factory
):
    # Arrange
    semester = semester_factory()
    for _ in range(3):
        course_offering_factory(semester=semester, instructors=[instructor_factory()])

    # Assert
    # 1) base courses + department/faculty
    # 2) offerings
    # 3) course_offering_specialities joined with speciality + faculty
    with django_assert_num_queries(3):
        repo.filter(CourseFilterCriteriaInternal())


@pytest.mark.django_db
@pytest.mark.integration
def test_get_or_create_keeps_bachelor_and_master_courses_separate(repo, course_factory):
    department = course_factory().department

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
def test_get_or_create_does_not_update_existing_course_fields(repo, course_factory):
    department = course_factory().department

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
def test_course_mapper_normalizes_empty_education_level_to_none(course_factory):
    course = course_factory(education_level="")
    mapper = CourseMapper()
    result = mapper.process(course)
    assert result.education_level is None


@pytest.mark.django_db
@pytest.mark.integration
def test_get_or_upsert_reuses_legacy_blank_level_course(repo, course_factory):
    legacy_course = course_factory(
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
