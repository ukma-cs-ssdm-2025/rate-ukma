import pytest

from rating_app.models.choices import SemesterTerm
from rating_app.repositories.student_stats_repository import StudentStatisticsRepository
from rating_app.repositories.to_domain_mappers import StudentMapper


@pytest.fixture
def rated_with_two_instructors(
    course_factory,
    semester_factory,
    course_offering_factory,
    enrollment_factory,
    rating_factory,
    instructor_factory,
):
    def _rated(student):
        course = course_factory()
        semester = semester_factory(term=SemesterTerm.SPRING, year=2025)
        offering = course_offering_factory(course=course, semester=semester)
        enrollment_factory(student=student, offering=offering)
        rating = rating_factory(student=student, course_offering=offering)
        first = instructor_factory(first_name="Олена", patronymic="Ігорівна", last_name="Коваленко")
        second = instructor_factory(first_name="Іван", patronymic="Петрович", last_name="Петренко")
        rating.instructors.set([first, second])
        return rating, first, second

    return _rated


@pytest.fixture
def repo():
    return StudentStatisticsRepository(mapper=StudentMapper())


# Tests for get_by_student method


@pytest.mark.django_db
@pytest.mark.integration
def test_get_by_student_returns_enrolled_courses(
    repo,
    student_factory,
    course_factory,
    semester_factory,
    course_offering_factory,
    enrollment_factory,
):
    # Arrange
    student = student_factory()
    course = course_factory(title="Enrolled Course")
    semester = semester_factory(term=SemesterTerm.FALL, year=2024)
    offering = course_offering_factory(course=course, semester=semester)
    enrollment_factory(student=student, offering=offering)

    # Act
    result = repo.get_rating_stats(student_id=str(student.id))

    # Assert
    assert isinstance(result, list)
    assert len(result) == 1
    assert result[0]["id"] == str(course.id)
    assert len(result[0]["offerings"]) == 1
    assert result[0]["offerings"][0]["id"] == str(offering.id)
    assert result[0]["offerings"][0]["year"] == 2024
    assert result[0]["offerings"][0]["season"] == SemesterTerm.FALL
    assert result[0]["offerings"][0]["rated"] is None


@pytest.mark.django_db
@pytest.mark.integration
def test_get_by_student_returns_rated_courses(
    repo,
    student_factory,
    course_factory,
    semester_factory,
    course_offering_factory,
    enrollment_factory,
    rating_factory,
):
    # Arrange
    student = student_factory()
    course = course_factory(title="Rated Course")
    semester = semester_factory(term=SemesterTerm.SPRING, year=2025)
    offering = course_offering_factory(course=course, semester=semester)
    enrollment_factory(student=student, offering=offering)
    rating = rating_factory(
        student=student,
        course_offering=offering,
        difficulty=4,
        usefulness=5,
        comment="Great course!",
    )

    # Act
    result = repo.get_rating_stats(student_id=str(student.id))

    # Assert
    assert len(result) == 1
    assert result[0]["id"] == str(course.id)
    assert len(result[0]["offerings"]) == 1
    assert result[0]["offerings"][0]["id"] == str(offering.id)
    assert result[0]["offerings"][0]["year"] == 2025
    assert result[0]["offerings"][0]["season"] == SemesterTerm.SPRING
    assert result[0]["offerings"][0]["rated"]["difficulty"] == 4
    assert result[0]["offerings"][0]["rated"]["usefulness"] == 5
    assert result[0]["offerings"][0]["rated"]["comment"] == "Great course!"
    assert result[0]["offerings"][0]["rated"]["created_at"] == rating.created_at


@pytest.mark.django_db
@pytest.mark.integration
def test_get_by_student_returns_enrolled_and_rated_courses(
    repo,
    student_factory,
    course_factory,
    semester_factory,
    course_offering_factory,
    enrollment_factory,
    rating_factory,
):
    # Arrange
    student = student_factory()
    course = course_factory(title="Enrolled and Rated")
    semester = semester_factory(term=SemesterTerm.FALL, year=2024)
    offering = course_offering_factory(course=course, semester=semester)
    enrollment_factory(student=student, offering=offering)
    rating = rating_factory(
        student=student, course_offering=offering, difficulty=3, usefulness=4, comment="Good"
    )

    # Act
    result = repo.get_rating_stats(student_id=str(student.id))

    # Assert
    assert len(result) == 1
    assert result[0]["id"] == str(course.id)
    assert len(result[0]["offerings"]) == 1
    assert result[0]["offerings"][0]["rated"]["difficulty"] == 3
    assert result[0]["offerings"][0]["rated"]["usefulness"] == 4
    assert result[0]["offerings"][0]["rated"]["comment"] == "Good"
    assert result[0]["offerings"][0]["rated"]["created_at"] == rating.created_at


@pytest.mark.django_db
@pytest.mark.integration
def test_get_by_student_excludes_unrelated_courses(
    repo, student_factory, course_factory, course_offering_factory, enrollment_factory
):
    # Arrange
    student1 = student_factory()
    student2 = student_factory()

    course1 = course_factory(title="Student 1 Course")
    offering1 = course_offering_factory(course=course1)
    enrollment_factory(student=student1, offering=offering1)

    course2 = course_factory(title="Student 2 Course")
    offering2 = course_offering_factory(course=course2)
    enrollment_factory(student=student2, offering=offering2)

    # Act
    result = repo.get_rating_stats(student_id=str(student1.id))

    # Assert
    assert len(result) == 1
    assert result[0]["id"] == str(course1.id)


@pytest.mark.django_db
@pytest.mark.integration
def test_get_by_student_returns_empty_list_for_student_with_no_courses(repo, student_factory):
    # Arrange
    student = student_factory()

    # Act
    result = repo.get_rating_stats(student_id=str(student.id))

    # Assert
    assert result == []


@pytest.mark.django_db
@pytest.mark.integration
def test_get_by_student_handles_multiple_offerings_same_course(
    repo,
    student_factory,
    course_factory,
    semester_factory,
    course_offering_factory,
    enrollment_factory,
    rating_factory,
):
    # Arrange
    student = student_factory()
    course = course_factory(title="Multi-offering Course")

    # Student enrolled in fall 2024
    fall_semester = semester_factory(term=SemesterTerm.FALL, year=2024)
    fall_offering = course_offering_factory(course=course, semester=fall_semester)
    enrollment_factory(student=student, offering=fall_offering)

    # Student rated in spring 2025
    spring_semester = semester_factory(term=SemesterTerm.SPRING, year=2025)
    spring_offering = course_offering_factory(course=course, semester=spring_semester)
    enrollment_factory(student=student, offering=spring_offering)
    rating_factory(
        student=student,
        course_offering=spring_offering,
        difficulty=5,
        usefulness=4,
        comment="Second time",
    )

    # Act
    result = repo.get_rating_stats(student_id=str(student.id))

    # Assert - Should return one course with two offerings (unordered)
    assert len(result) == 1
    assert result[0]["id"] == str(course.id)
    assert len(result[0]["offerings"]) == 2

    # Check both offerings are present (order doesn't matter)
    offering_ids = {off["id"] for off in result[0]["offerings"]}
    assert offering_ids == {str(fall_offering.id), str(spring_offering.id)}

    # Find offerings by ID
    fall_off = next(off for off in result[0]["offerings"] if off["id"] == str(fall_offering.id))
    spring_off = next(off for off in result[0]["offerings"] if off["id"] == str(spring_offering.id))

    # Check fall offering (enrolled only)
    assert fall_off["year"] == 2024
    assert fall_off["season"] == SemesterTerm.FALL
    assert fall_off["rated"] is None

    # Check spring offering (rated)
    assert spring_off["year"] == 2025
    assert spring_off["season"] == SemesterTerm.SPRING
    assert spring_off["rated"] is not None


# Enrollment-status tests for get_by_student (mirror detailed tests)


@pytest.mark.django_db
@pytest.mark.integration
def test_get_by_student_does_not_return_dropped_offerings(
    repo,
    student_factory,
    semester_factory,
    course_factory,
    course_offering_factory,
    enrollment_factory,
):
    # Arrange
    student = student_factory()

    # 2025 Spring - Course B (dropped)
    spring_2025 = semester_factory(term=SemesterTerm.SPRING, year=2025)
    course_b = course_factory(title="B Course")
    offering_b_2025 = course_offering_factory(course=course_b, semester=spring_2025)
    enrollment_factory(student=student, offering=offering_b_2025, status="DROPPED")

    # 2024 Fall - Course A (enrolled)
    fall_2024 = semester_factory(term=SemesterTerm.FALL, year=2024)
    course_a = course_factory(title="A Course")
    offering_a_2024 = course_offering_factory(course=course_a, semester=fall_2024)
    enrollment_factory(student=student, offering=offering_a_2024)

    # Act
    result = repo.get_rating_stats(student_id=str(student.id))

    # Assert - only the enrolled course should be returned
    assert len(result) == 1
    assert result[0]["id"] == str(course_a.id)
    assert result[0]["offerings"][0]["id"] == str(offering_a_2024.id)


@pytest.mark.django_db
@pytest.mark.integration
def test_get_by_student_returns_enrolled_and_forced_offerings(
    repo,
    student_factory,
    semester_factory,
    course_factory,
    course_offering_factory,
    enrollment_factory,
):
    # Arrange
    student = student_factory()

    # 2025 Spring - Course B - FORCED
    spring_2025 = semester_factory(term=SemesterTerm.SPRING, year=2025)
    course_b = course_factory(title="B Course")
    offering_b_2025 = course_offering_factory(course=course_b, semester=spring_2025)
    enrollment_factory(student=student, offering=offering_b_2025, status="FORCED")

    # 2024 Fall - Course A - ENROLLED (by default)
    fall_2024 = semester_factory(term=SemesterTerm.FALL, year=2024)
    course_a = course_factory(title="A Course")
    offering_a_2024 = course_offering_factory(course=course_a, semester=fall_2024)
    enrollment_factory(student=student, offering=offering_a_2024)

    # Act
    result = repo.get_rating_stats(student_id=str(student.id))

    # Assert - both courses should appear (unordered)
    assert len(result) == 2
    course_ids = {c["id"] for c in result}
    assert course_ids == {str(course_a.id), str(course_b.id)}


# Tests for get_detailed_by_student method


@pytest.mark.django_db
@pytest.mark.integration
def test_get_detailed_by_student_returns_enrolled_offerings(
    repo,
    student_factory,
    course_factory,
    semester_factory,
    course_offering_factory,
    enrollment_factory,
):
    # Arrange
    student = student_factory()
    course = course_factory(title="Test Course")
    semester = semester_factory(term=SemesterTerm.FALL, year=2024)
    offering = course_offering_factory(course=course, semester=semester)
    enrollment_factory(student=student, offering=offering)

    # Act
    result = repo.get_detailed_rating_stats(student_id=str(student.id))

    # Assert
    assert len(result) == 1
    assert result[0]["course_id"] == str(course.id)
    assert result[0]["course_title"] == "Test Course"
    assert result[0]["course_offering_id"] == str(offering.id)
    assert result[0]["semester"]["year"] == 2024
    assert result[0]["semester"]["season"] == SemesterTerm.FALL
    assert result[0]["rated"] is None


@pytest.mark.django_db
@pytest.mark.integration
def test_get_detailed_by_student_includes_rating_with_created_at(
    repo,
    student_factory,
    course_factory,
    semester_factory,
    course_offering_factory,
    enrollment_factory,
    rating_factory,
):
    # Arrange
    student = student_factory()
    course = course_factory(title="Rated Course")
    semester = semester_factory(term=SemesterTerm.SPRING, year=2025)
    offering = course_offering_factory(course=course, semester=semester)
    enrollment_factory(student=student, offering=offering)
    rating = rating_factory(
        student=student, course_offering=offering, difficulty=4, usefulness=5, comment="Excellent!"
    )

    # Act
    result = repo.get_detailed_rating_stats(student_id=str(student.id))

    # Assert
    assert len(result) == 1
    assert result[0]["rated"]["difficulty"] == 4
    assert result[0]["rated"]["usefulness"] == 5
    assert result[0]["rated"]["comment"] == "Excellent!"
    assert result[0]["rated"]["created_at"] == rating.created_at


@pytest.mark.django_db
@pytest.mark.integration
def test_get_detailed_by_student_returns_one_record_per_offering(
    repo,
    student_factory,
    course_factory,
    semester_factory,
    course_offering_factory,
    enrollment_factory,
    rating_factory,
):
    # Arrange
    student = student_factory()
    course = course_factory(title="Multi-semester Course")

    # Fall 2024
    fall_semester = semester_factory(term=SemesterTerm.FALL, year=2024)
    fall_offering = course_offering_factory(course=course, semester=fall_semester)
    enrollment_factory(student=student, offering=fall_offering)

    # Spring 2025
    spring_semester = semester_factory(term=SemesterTerm.SPRING, year=2025)
    spring_offering = course_offering_factory(course=course, semester=spring_semester)
    enrollment_factory(student=student, offering=spring_offering)
    rating_factory(student=student, course_offering=spring_offering, difficulty=5, usefulness=5)

    # Act
    result = repo.get_detailed_rating_stats(student_id=str(student.id))

    # Assert - Should have 2 records (one per offering)
    assert len(result) == 2
    assert result[0]["course_offering_id"] == str(fall_offering.id)
    assert result[0]["rated"] is None
    assert result[1]["course_offering_id"] == str(spring_offering.id)
    assert result[1]["rated"] is not None


@pytest.mark.django_db
@pytest.mark.integration
def test_get_detailed_by_student_excludes_other_students(
    repo, student_factory, course_factory, course_offering_factory, enrollment_factory
):
    # Arrange
    student1 = student_factory()
    student2 = student_factory()

    course1 = course_factory(title="Student 1 Course")
    offering1 = course_offering_factory(course=course1)
    enrollment_factory(student=student1, offering=offering1)

    course2 = course_factory(title="Student 2 Course")
    offering2 = course_offering_factory(course=course2)
    enrollment_factory(student=student2, offering=offering2)

    # Act
    result = repo.get_detailed_rating_stats(student_id=str(student1.id))

    # Assert
    assert len(result) == 1
    assert result[0]["course_id"] == str(course1.id)


@pytest.mark.django_db
@pytest.mark.integration
def test_get_detailed_by_student_returns_empty_for_no_enrollments(repo, student_factory):
    # Arrange
    student = student_factory()

    # Act
    result = repo.get_detailed_rating_stats(student_id=str(student.id))

    # Assert
    assert result == []


@pytest.mark.django_db
@pytest.mark.integration
def test_get_detailed_by_student_excludes_non_enrolled_offerings(
    repo,
    student_factory,
    course_factory,
    semester_factory,
    course_offering_factory,
    enrollment_factory,
    rating_factory,
):
    # Arrange
    student = student_factory()
    course = course_factory()

    # Enrolled offering
    enrolled_semester = semester_factory(term=SemesterTerm.FALL, year=2024)
    enrolled_offering = course_offering_factory(course=course, semester=enrolled_semester)
    enrollment_factory(student=student, offering=enrolled_offering)

    # Not enrolled but rated (should not appear)
    other_semester = semester_factory(term=SemesterTerm.SPRING, year=2025)
    other_offering = course_offering_factory(course=course, semester=other_semester)
    rating_factory(student=student, course_offering=other_offering)

    # Act
    result = repo.get_detailed_rating_stats(student_id=str(student.id))

    # Assert - Only enrolled offering should appear
    assert len(result) == 1
    assert result[0]["course_offering_id"] == str(enrolled_offering.id)


@pytest.mark.django_db
@pytest.mark.integration
def test_get_detailed_by_student_orders_by_semester_then_course(
    repo,
    student_factory,
    semester_factory,
    course_factory,
    course_offering_factory,
    enrollment_factory,
):
    # Arrange
    student = student_factory()

    # 2025 Spring - Course B
    spring_2025 = semester_factory(term=SemesterTerm.SPRING, year=2025)
    course_b = course_factory(title="B Course")
    offering_b_2025 = course_offering_factory(course=course_b, semester=spring_2025)
    enrollment_factory(student=student, offering=offering_b_2025)

    # 2024 Fall - Course A
    fall_2024 = semester_factory(term=SemesterTerm.FALL, year=2024)
    course_a = course_factory(title="A Course")
    offering_a_2024 = course_offering_factory(course=course_a, semester=fall_2024)
    enrollment_factory(student=student, offering=offering_a_2024)

    # 2024 Fall - Course C
    course_c = course_factory(title="C Course")
    offering_c_2024 = course_offering_factory(course=course_c, semester=fall_2024)
    enrollment_factory(student=student, offering=offering_c_2024)

    # Act
    result = repo.get_detailed_rating_stats(student_id=str(student.id))

    # Assert - Ordered by semester (year, term), then by course title
    assert len(result) == 3
    # 2024 Fall offerings first (A, then C alphabetically)
    assert result[0]["semester"]["year"] == 2024
    assert result[0]["course_title"] == "A Course"
    assert result[1]["semester"]["year"] == 2024
    assert result[1]["course_title"] == "C Course"
    # 2025 Spring offerings last
    assert result[2]["semester"]["year"] == 2025
    assert result[2]["course_title"] == "B Course"


@pytest.mark.django_db
@pytest.mark.integration
def test_get_detailed_by_student_does_not_return_dropped_offerings(
    repo,
    student_factory,
    semester_factory,
    course_factory,
    course_offering_factory,
    enrollment_factory,
):
    # Arrange
    student = student_factory()

    # 2025 Spring - Course B
    spring_2025 = semester_factory(term=SemesterTerm.SPRING, year=2025)
    course_b = course_factory(title="B Course")
    offering_b_2025 = course_offering_factory(course=course_b, semester=spring_2025)
    enrollment_factory(student=student, offering=offering_b_2025, status="DROPPED")

    # 2024 Fall - Course A
    fall_2024 = semester_factory(term=SemesterTerm.FALL, year=2024)
    course_a = course_factory(title="A Course")
    offering_a_2024 = course_offering_factory(course=course_a, semester=fall_2024)
    enrollment_factory(student=student, offering=offering_a_2024)

    # Act
    result = repo.get_detailed_rating_stats(student_id=str(student.id))

    # Assert - Ordered by semester (year, term), then by course title
    assert len(result) == 1
    assert result[0]["course_title"] == "A Course"


@pytest.mark.django_db
@pytest.mark.integration
def test_get_detailed_by_student_returns_enrolled_and_forced_offerings(
    repo,
    student_factory,
    semester_factory,
    course_factory,
    course_offering_factory,
    enrollment_factory,
):
    # Arrange
    student = student_factory()

    # 2025 Spring - Course B - FORCED
    spring_2025 = semester_factory(term=SemesterTerm.SPRING, year=2025)
    course_b = course_factory(title="B Course")
    offering_b_2025 = course_offering_factory(course=course_b, semester=spring_2025)
    enrollment_factory(student=student, offering=offering_b_2025, status="FORCED")

    # 2024 Fall - Course A - ENROLLED (by default)
    fall_2024 = semester_factory(term=SemesterTerm.FALL, year=2024)
    course_a = course_factory(title="A Course")
    offering_a_2024 = course_offering_factory(course=course_a, semester=fall_2024)
    enrollment_factory(student=student, offering=offering_a_2024)

    # Act
    result = repo.get_detailed_rating_stats(student_id=str(student.id))

    # Assert - Ordered by semester (year, term), then by course title
    assert len(result) == 2
    assert result[0]["course_title"] == "A Course"
    assert result[1]["course_title"] == "B Course"


@pytest.mark.django_db
@pytest.mark.integration
def test_get_detailed_by_student_includes_all_course_fields(
    repo,
    student_factory,
    course_factory,
    semester_factory,
    course_offering_factory,
    enrollment_factory,
):
    # Arrange
    student = student_factory()
    course = course_factory(title="Complete Course")
    semester = semester_factory(term=SemesterTerm.FALL, year=2024)
    offering = course_offering_factory(course=course, semester=semester)
    enrollment_factory(student=student, offering=offering)

    # Act
    result = repo.get_detailed_rating_stats(student_id=str(student.id))

    # Assert - Check all required fields are present
    assert len(result) == 1
    record = result[0]
    assert "course_id" in record
    assert "course_title" in record
    assert "course_code" in record
    assert "course_offering_id" in record
    assert "semester" in record
    assert "year" in record["semester"]
    assert "season" in record["semester"]
    assert "rated" in record


@pytest.mark.django_db
@pytest.mark.integration
def test_get_rating_stats_includes_m2m_instructors(
    repo, student_factory, rated_with_two_instructors
):
    student = student_factory()
    rating, first, second = rated_with_two_instructors(student)

    result = repo.get_rating_stats(student_id=str(student.id))

    rated = result[0]["offerings"][0]["rated"]
    assert rated["id"] == str(rating.id)
    instructors_by_id = {i["id"]: i for i in rated["instructors"]}
    assert set(instructors_by_id) == {str(first.id), str(second.id)}
    assert instructors_by_id[str(first.id)]["last_name"] == "Коваленко"
    assert instructors_by_id[str(first.id)]["patronymic"] == "Ігорівна"


@pytest.mark.django_db
@pytest.mark.integration
def test_get_detailed_rating_stats_includes_m2m_instructors(
    repo, student_factory, rated_with_two_instructors
):
    student = student_factory()
    rating, first, second = rated_with_two_instructors(student)

    result = repo.get_detailed_rating_stats(student_id=str(student.id))

    rated = result[0]["rated"]
    assert rated["id"] == str(rating.id)
    assert {i["id"] for i in rated["instructors"]} == {str(first.id), str(second.id)}


@pytest.mark.django_db
@pytest.mark.integration
def test_get_rating_stats_returns_empty_instructors_when_none_linked(
    repo,
    student_factory,
    course_factory,
    semester_factory,
    course_offering_factory,
    enrollment_factory,
    rating_factory,
):
    student = student_factory()
    course = course_factory()
    semester = semester_factory(term=SemesterTerm.SPRING, year=2025)
    offering = course_offering_factory(course=course, semester=semester)
    enrollment_factory(student=student, offering=offering)
    rating_factory(student=student, course_offering=offering)

    result = repo.get_rating_stats(student_id=str(student.id))

    assert result[0]["offerings"][0]["rated"]["instructors"] == []


@pytest.mark.django_db
@pytest.mark.integration
def test_get_detailed_by_student_includes_faculty_name(repo):
    # Arrange
    student = StudentFactory()
    course = CourseFactory(title="Faculty Course")
    semester = SemesterFactory(term=SemesterTerm.FALL, year=2024)
    offering = CourseOfferingFactory(course=course, semester=semester)
    EnrollmentFactory(student=student, offering=offering)

    # Act
    result = repo.get_detailed_rating_stats(student_id=str(student.id))

    # Assert
    assert len(result) == 1
    assert result[0]["faculty_name"] == course.department.faculty.name
