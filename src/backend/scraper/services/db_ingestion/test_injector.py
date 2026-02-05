from types import SimpleNamespace
from unittest.mock import MagicMock, Mock, patch

import pytest
from faker import Faker

from scraper.models.deduplicated import (
    CourseStatus,
    DeduplicatedCourse,
    DeduplicatedCourseInstructor,
    DeduplicatedCourseOffering,
    DeduplicatedEnrollment,
    DeduplicatedInstructor,
    DeduplicatedSemester,
    DeduplicatedSpeciality,
    DeduplicatedStudent,
    EducationLevel,
    EnrollmentStatus,
    ExamType,
    InstructorRole,
    PracticeType,
    SemesterTerm,
)
from scraper.services.db_ingestion.injector import CourseDbInjector

faker = Faker()


@pytest.fixture(autouse=True)
def mock_atomic():
    with patch("scraper.services.db_ingestion.injector.transaction.atomic") as mock:
        mock.return_value.__enter__.return_value = None
        mock.return_value.__exit__.return_value = None
        yield mock


@pytest.fixture()
def repo_mocks():
    course_repo = MagicMock()
    dept_repo = MagicMock()
    faculty_repo = MagicMock()
    semester_repo = MagicMock()
    speciality_repo = MagicMock()
    instructor_repo = MagicMock()
    student_repo = MagicMock()
    offering_repo = MagicMock()
    course_instructor_repo = MagicMock()
    enrollment_repo = MagicMock()
    tracker = MagicMock()
    student_service = MagicMock()
    cache_manager = MagicMock()
    faculty = SimpleNamespace(name=faker.company(), id=1)
    department = SimpleNamespace(name=faker.catch_phrase(), id=2)
    course = Mock()
    course.id = 3
    course.specialities = Mock()
    course.specialities.add = Mock()
    semester = SimpleNamespace(year=2024, term="FALL", id=faker.uuid4())
    course_offering = SimpleNamespace()
    speciality = SimpleNamespace(name=faker.word())
    instructor = SimpleNamespace()
    student = SimpleNamespace(email="", user=None)

    faculty_repo.get_or_create.return_value = (faculty, True)
    dept_repo.get_or_create.return_value = (department, True)
    course_repo.get_or_create_model.return_value = (course, True)
    semester_repo.get_or_create.return_value = (semester, True)
    offering_repo.get_or_upsert.return_value = (course_offering, True)
    speciality_repo.get_by_name.return_value = speciality
    instructor_repo.get_or_create.return_value = (instructor, True)
    student_repo.get_or_create.return_value = (student, True)

    return SimpleNamespace(
        course_repo=course_repo,
        dept_repo=dept_repo,
        faculty_repo=faculty_repo,
        semester_repo=semester_repo,
        speciality_repo=speciality_repo,
        instructor_repo=instructor_repo,
        student_repo=student_repo,
        offering_repo=offering_repo,
        course_instructor_repo=course_instructor_repo,
        enrollment_repo=enrollment_repo,
        tracker=tracker,
        student_service=student_service,
        faculty=faculty,
        department=department,
        course=course,
        semester=semester,
        course_offering=course_offering,
        speciality=speciality,
        instructor=instructor,
        student=student,
        cache_manager=cache_manager,
    )


@pytest.fixture()
def injector(repo_mocks) -> CourseDbInjector:
    return CourseDbInjector(
        repo_mocks.course_repo,
        repo_mocks.dept_repo,
        repo_mocks.faculty_repo,
        repo_mocks.semester_repo,
        repo_mocks.speciality_repo,
        repo_mocks.instructor_repo,
        repo_mocks.student_repo,
        repo_mocks.offering_repo,
        repo_mocks.course_instructor_repo,
        repo_mocks.enrollment_repo,
        repo_mocks.tracker,
        repo_mocks.student_service,
        repo_mocks.cache_manager,
    )


def create_mock_course(
    *,
    title: str = "Course",
    description: str | None = None,
    status: CourseStatus = CourseStatus.ACTIVE,
    department: str = "Dept",
    faculty: str = "Fac",
    education_level: EducationLevel | None = None,
    specialities: list[DeduplicatedSpeciality] | None = None,
    offerings: list[DeduplicatedCourseOffering] | None = None,
) -> DeduplicatedCourse:
    return DeduplicatedCourse(
        title=title,
        description=description,
        status=status,
        department=department,
        faculty=faculty,
        education_level=education_level,
        specialities=specialities or [],
        offerings=offerings or [],
    )


def create_mock_no_speciality_payload() -> list[DeduplicatedCourse]:
    return [
        create_mock_course(
            title="Course C",
            offerings=[
                create_mock_offering(
                    code="XYZ789",
                    term=SemesterTerm.SPRING,
                    exam_type=ExamType.CREDIT,
                    instructors=[],
                    enrollments=[
                        create_mock_enrollment(
                            first_name="Jane",
                            last_name="Smith",
                            speciality="",
                            level=EducationLevel.MASTER,
                        )
                    ],
                )
            ],
        )
    ]


def create_mock_empty_education_level_payload() -> list[DeduplicatedCourse]:
    return [
        create_mock_course(
            title="Course D",
            offerings=[
                create_mock_offering(
                    code="XYZ999",
                    term=SemesterTerm.SPRING,
                    exam_type=ExamType.CREDIT,
                    instructors=[],
                    enrollments=[
                        create_mock_enrollment(
                            first_name="Bob",
                            last_name="Johnson",
                            speciality="SpecX",
                            level=None,  # Empty education level
                        )
                    ],
                )
            ],
        )
    ]


def create_mock_payload() -> list[DeduplicatedCourse]:
    return [
        create_mock_course(
            title="Course B",
            offerings=[
                create_mock_offering(
                    instructors=[create_mock_instr()],
                    enrollments=[create_mock_enrollment()],
                )
            ],
        )
    ]


def create_mock_spec(name: str, faculty: str) -> DeduplicatedSpeciality:
    return DeduplicatedSpeciality(name=name, faculty=faculty)


def create_mock_instr(
    first_name: str = "Ada",
    last_name: str = "Lovelace",
    role: InstructorRole = InstructorRole.LECTURE_INSTRUCTOR,
) -> DeduplicatedCourseInstructor:
    return DeduplicatedCourseInstructor(
        instructor=DeduplicatedInstructor(first_name=first_name, last_name=last_name),
        role=role,
    )


def create_mock_enrollment(
    *,
    first_name: str = "John",
    last_name: str = "Doe",
    speciality: str = "SpecX",
    level: EducationLevel | None = EducationLevel.BACHELOR,
    status: EnrollmentStatus = EnrollmentStatus.ENROLLED,
    email: str = "",
) -> DeduplicatedEnrollment:
    return DeduplicatedEnrollment(
        student=DeduplicatedStudent(
            first_name=first_name,
            last_name=last_name,
            speciality=speciality,
            education_level=level,
            email=email,
        ),
        status=status,
    )


def create_mock_offering(
    *,
    code: str = "ABC123",
    year: int = 2024,
    term: SemesterTerm = SemesterTerm.FALL,
    exam_type: ExamType = ExamType.EXAM,
    practice_type: PracticeType | None = PracticeType.PRACTICE,
    credits: float = 3.0,
    weekly_hours: int = 4,
    lecture_count: int | None = 12,
    practice_count: int | None = 12,
    max_students: int | None = 30,
    max_groups: int | None = 2,
    group_size_min: int | None = 10,
    group_size_max: int | None = 15,
    instructors: list[DeduplicatedCourseInstructor] | None = None,
    enrollments: list[DeduplicatedEnrollment] | None = None,
) -> DeduplicatedCourseOffering:
    return DeduplicatedCourseOffering(
        code=code,
        semester=DeduplicatedSemester(year=year, term=term),
        credits=credits,
        weekly_hours=weekly_hours,
        lecture_count=lecture_count,
        practice_count=practice_count,
        practice_type=practice_type,
        exam_type=exam_type,
        max_students=max_students,
        max_groups=max_groups,
        group_size_min=group_size_min,
        group_size_max=group_size_max,
        instructors=instructors or [],
        enrollments=enrollments or [],
    )


@pytest.mark.django_db
def test_injector_basic_flow_calls_repos_and_tracker(injector, repo_mocks):
    # Arrange
    repo_mocks.course_repo.get_or_create_model.return_value = (repo_mocks.course, True)
    models = [create_mock_course(title="Intro to Testing", department="CS", faculty="FAMCS")]

    # Act
    injector.execute(models)

    # Assert
    repo_mocks.tracker.start.assert_called_once_with(1)
    repo_mocks.tracker.increment.assert_called_once()
    repo_mocks.faculty_repo.get_or_create.assert_called_once_with(name="FAMCS")
    repo_mocks.dept_repo.get_or_create.assert_called_once()
    repo_mocks.course_repo.get_or_create_model.assert_called_once()
    repo_mocks.tracker.complete.assert_called_once()


@pytest.mark.django_db
def test_injector_processes_specialities(injector, repo_mocks):
    # Arrange
    existing_spec = SimpleNamespace()
    new_spec = SimpleNamespace()
    repo_mocks.speciality_repo.get_by_name.side_effect = [existing_spec, None]
    repo_mocks.faculty_repo.get_by_speciality_name.return_value = repo_mocks.faculty
    repo_mocks.speciality_repo.create.return_value = new_spec
    models = [
        create_mock_course(
            title="Course A",
            specialities=[create_mock_spec("Spec1", "Fac"), create_mock_spec("Spec2", "Fac")],
        )
    ]

    # Act
    injector.execute(models)

    # Assert
    assert repo_mocks.course.specialities.add.call_count == 2
    repo_mocks.speciality_repo.get_by_name.assert_any_call(name="Spec1")
    repo_mocks.speciality_repo.get_by_name.assert_any_call(name="Spec2")
    repo_mocks.speciality_repo.create.assert_called_once()


@pytest.mark.django_db
def test_injector_processes_offerings_instructors_and_enrollments(injector, repo_mocks):
    # Arrange
    models = create_mock_payload()

    # Act
    injector.execute(models)

    # Assert
    repo_mocks.semester_repo.get_or_create.assert_called_once_with(year=2024, term="FALL")
    repo_mocks.offering_repo.get_or_upsert.assert_called_once()
    repo_mocks.instructor_repo.get_or_create.assert_called_once()
    repo_mocks.course_instructor_repo.get_or_create.assert_called_once()
    repo_mocks.student_repo.get_or_create.assert_called_once()
    repo_mocks.enrollment_repo.get_or_upsert.assert_called_once()


@pytest.mark.django_db
def test_injector_handles_exception_and_calls_fail(injector, repo_mocks):
    # Arrange
    repo_mocks.faculty_repo.get_or_create.side_effect = RuntimeError("boom")
    models = [create_mock_course(title="Broken Course")]

    # Act
    with pytest.raises(RuntimeError):
        injector.execute(models)

    # Assert
    repo_mocks.tracker.fail.assert_called_once()
    repo_mocks.tracker.complete.assert_not_called()


@pytest.mark.django_db
def test_injector_skips_student_creation_when_missing_speciality(injector, repo_mocks):
    # Arrange
    models = create_mock_no_speciality_payload()

    # Act
    injector.execute(models)

    # Assert
    repo_mocks.student_repo.get_or_create.assert_not_called()


@pytest.mark.django_db
def test_injector_handles_empty_education_level(injector, repo_mocks):
    # Arrange
    models = create_mock_empty_education_level_payload()

    # Act
    injector.execute(models)

    # Assert
    # Should create the student with empty education level
    repo_mocks.student_repo.get_or_create.assert_called_once()
    call_args = repo_mocks.student_repo.get_or_create.call_args
    assert call_args[1]["education_level"] == ""


@pytest.mark.django_db
def test_injector_invalidates_cache_after_successful_execution(injector, repo_mocks):
    # Arrange
    models = create_mock_payload()

    # Act
    injector.execute(models)

    # Assert
    assert repo_mocks.cache_manager.invalidate_pattern.call_count == 3
    repo_mocks.cache_manager.invalidate_pattern.assert_any_call("*course*")
    repo_mocks.cache_manager.invalidate_pattern.assert_any_call("*ratings*")
    repo_mocks.cache_manager.invalidate_pattern.assert_any_call("*get_filter_options*")


@pytest.mark.django_db
def test_injector_does_not_invalidate_cache_on_exception(injector, repo_mocks):
    # Arrange
    repo_mocks.faculty_repo.get_or_create.side_effect = RuntimeError("error")
    models = [create_mock_course(title="Invalid Course")]

    # Act
    with pytest.raises(RuntimeError):
        injector.execute(models)

    # Assert
    repo_mocks.cache_manager.invalidate_pattern.assert_not_called()
