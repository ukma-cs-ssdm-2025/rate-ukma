from types import SimpleNamespace
from unittest.mock import MagicMock, Mock, patch
from uuid import uuid4

import pytest
from faker import Faker

from scraper.models.deduplicated import (
    CourseStatus,
    CourseTypeKind,
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


@pytest.fixture(autouse=True)
def mock_speciality_objects_get():
    """Patch Speciality.objects.get to return a mock for tests that use DTOs."""
    with patch("scraper.services.db_ingestion.injector.Speciality.objects.get") as mock:
        mock.return_value = SimpleNamespace(id=uuid4(), name="MockSpeciality")
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
    student_mapper = MagicMock()
    faculty = SimpleNamespace(name=faker.company(), id=1)
    department = SimpleNamespace(name=faker.catch_phrase(), id=2)
    course = Mock()
    course.id = 3
    course.specialities = Mock()
    course.specialities.add = Mock()
    semester = SimpleNamespace(year=2024, term="FALL", id=faker.uuid4())
    course_offering = SimpleNamespace(id=uuid4(), code="ABC123")
    speciality = SimpleNamespace(name=faker.word(), id=faker.uuid4())
    instructor = SimpleNamespace(id=uuid4())
    student = SimpleNamespace(
        id=faker.uuid4(),
        email="",
        user=None,
        first_name="Test",
        last_name="Student",
        patronymic="",
        education_level="",
        speciality_id=faker.uuid4(),
        user_id=None,
    )

    faculty_repo.get_or_create.return_value = (faculty, True)
    dept_repo.get_or_create.return_value = (department, True)
    course_repo.get_or_create.return_value = (course, True)
    semester_repo.get_or_create.return_value = (semester, True)
    offering_repo.get_or_upsert.return_value = (course_offering, True)
    speciality_repo.get_by_name.return_value = speciality
    instructor_repo.get_or_create.return_value = (instructor, True)
    student_repo.get_or_upsert.return_value = (student, True)

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
        student_mapper=student_mapper,
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
        repo_mocks.student_mapper,
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


def create_mock_spec(
    name: str,
    faculty: str,
    type_kind: CourseTypeKind | None = None,
) -> DeduplicatedSpeciality:
    return DeduplicatedSpeciality(name=name, faculty=faculty, type_kind=type_kind)


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
    study_year: int | None = None,
    lecture_count: int | None = 12,
    practice_count: int | None = 12,
    max_students: int | None = 30,
    max_groups: int | None = 2,
    group_size_min: int | None = 10,
    group_size_max: int | None = 15,
    instructors: list[DeduplicatedCourseInstructor] | None = None,
    enrollments: list[DeduplicatedEnrollment] | None = None,
    specialities: list[DeduplicatedSpeciality] | None = None,
) -> DeduplicatedCourseOffering:
    return DeduplicatedCourseOffering(
        code=code,
        semester=DeduplicatedSemester(year=year, term=term),
        credits=credits,
        weekly_hours=weekly_hours,
        study_year=study_year,
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
        specialities=specialities or [],
    )


@pytest.mark.django_db
def test_injector_basic_flow_calls_repos_and_tracker(injector, repo_mocks):
    # Arrange
    repo_mocks.course_repo.get_or_create.return_value = (repo_mocks.course, True)
    models = [create_mock_course(title="Intro to Testing", department="CS", faculty="FAMCS")]

    # Act
    injector.execute(models)

    # Assert
    repo_mocks.tracker.start.assert_called_once_with(1)
    repo_mocks.tracker.increment.assert_called_once()
    # Faculty repo now uses DTO-based API with return_model=True
    repo_mocks.faculty_repo.get_or_create.assert_called_once()
    call_args = repo_mocks.faculty_repo.get_or_create.call_args
    faculty_dto = call_args[0][0]  # First positional arg is the DTO
    assert faculty_dto.name == "FAMCS"
    assert call_args[1].get("return_model") is True
    repo_mocks.dept_repo.get_or_create.assert_called_once()
    repo_mocks.course_repo.get_or_create.assert_called_once()
    course_dto = repo_mocks.course_repo.get_or_create.call_args[0][0]
    assert course_dto.education_level is None
    repo_mocks.tracker.complete.assert_called_once()


@pytest.mark.django_db
def test_injector_passes_course_education_level(injector, repo_mocks):
    models = [
        create_mock_course(
            title="History of Borders",
            education_level=EducationLevel.BACHELOR,
            offerings=[
                create_mock_offering(
                    code="363683",
                )
            ],
        )
    ]

    injector.execute(models)

    course_dto = repo_mocks.course_repo.get_or_create.call_args[0][0]

    assert course_dto.education_level == EducationLevel.BACHELOR


@pytest.mark.django_db
def test_injector_processes_specialities(injector, repo_mocks):
    # Arrange
    existing_spec_dto = SimpleNamespace(id=uuid4())  # DTO returned by get_by_name
    new_spec_orm = SimpleNamespace(id=uuid4())
    repo_mocks.speciality_repo.get_by_name.side_effect = [existing_spec_dto, None]
    repo_mocks.faculty_repo.get_or_create.return_value = (repo_mocks.faculty, True)
    repo_mocks.speciality_repo.get_or_create.return_value = (new_spec_orm, True)

    models = [
        create_mock_course(
            title="Course A",
            specialities=[
                create_mock_spec("Spec1", "Fac", type_kind=CourseTypeKind.COMPULSORY),
                create_mock_spec("Spec2", "Fac", type_kind=CourseTypeKind.ELECTIVE),
            ],
        )
    ]

    # Act
    injector.execute(models)

    # Assert - verify specialities are looked up and created as needed
    repo_mocks.speciality_repo.get_by_name.assert_any_call(name="Spec1")
    repo_mocks.speciality_repo.get_by_name.assert_any_call(name="Spec2")
    repo_mocks.speciality_repo.get_or_create.assert_called_once()


@pytest.mark.django_db
def test_injector_processes_offerings_instructors_and_enrollments(injector, repo_mocks):
    # Arrange
    models = create_mock_payload()

    # Act
    injector.execute(models)

    # Assert - now using DTO-based API with return_model=True
    repo_mocks.semester_repo.get_or_create.assert_called_once()
    repo_mocks.offering_repo.get_or_upsert.assert_called_once()
    repo_mocks.instructor_repo.get_or_create.assert_called_once()
    repo_mocks.course_instructor_repo.get_or_create.assert_called_once()
    repo_mocks.student_repo.get_or_upsert.assert_called_once()
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
    repo_mocks.student_repo.get_or_upsert.assert_not_called()


@pytest.mark.django_db
def test_injector_handles_empty_education_level(injector, repo_mocks):
    # Arrange
    models = create_mock_empty_education_level_payload()

    # Act
    injector.execute(models)

    # Assert
    # Should create the student with empty education level using DTO-based API
    repo_mocks.student_repo.get_or_upsert.assert_called_once()
    call_args = repo_mocks.student_repo.get_or_upsert.call_args
    student_dto = call_args[0][0]  # First positional arg is the DTO
    assert student_dto.education_level == ""


@pytest.mark.django_db
def test_injector_passes_program_start_year_and_term_hours_to_repositories(injector, repo_mocks):
    models = [
        create_mock_course(
            title="Course With Rich Offering Data",
            offerings=[
                create_mock_offering(
                    credits=4.0,
                    weekly_hours=3,
                    year=2025,
                    term=SemesterTerm.FALL,
                    study_year=3,
                    specialities=[
                        create_mock_spec("SpecX", "Fac", type_kind=CourseTypeKind.COMPULSORY)
                    ],
                    enrollments=[
                        DeduplicatedEnrollment(
                            student=DeduplicatedStudent(
                                first_name="Jane",
                                last_name="Doe",
                                speciality="SpecX",
                                education_level=EducationLevel.BACHELOR,
                                email="jane.doe@ukma.edu.ua",
                                program_start_academic_year_start=2023,
                            ),
                            status=EnrollmentStatus.ENROLLED,
                        )
                    ],
                )
            ],
            specialities=[create_mock_spec("SpecX", "Fac", type_kind=CourseTypeKind.COMPULSORY)],
        )
    ]

    with patch(
        "scraper.services.db_ingestion.injector.CourseOfferingSpeciality.objects"
    ) as mock_cos:
        mock_cos.update_or_create.return_value = (MagicMock(), True)
        injector.execute(models)

    offering_call = repo_mocks.offering_repo.get_or_upsert.call_args
    offering_dto = offering_call[0][0]
    assert offering_dto.study_year == 3

    student_call = repo_mocks.student_repo.get_or_upsert.call_args
    student_dto = student_call[0][0]
    assert student_dto.program_start_academic_year_start == 2023


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
def test_injector_logs_warning_when_type_kind_is_none(injector, repo_mocks):
    # Arrange
    repo_mocks.speciality_repo.get_by_name.return_value = SimpleNamespace(id=uuid4())
    models = [
        create_mock_course(
            title="Course E",
            specialities=[create_mock_spec("Spec1", "Fac", type_kind=None)],
        )
    ]

    # Act
    injector.execute(models)

    # Assert - speciality is still processed and cached, just logs a warning
    # Note: CourseSpeciality through-table is deprecated, so we no longer verify its creation
    repo_mocks.speciality_repo.get_by_name.assert_called_with(name="Spec1")


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


@pytest.mark.django_db
def test_injector_processes_offering_specialities(injector, repo_mocks):
    # Arrange — course-level speciality populates the cache; offering references same name
    repo_mocks.speciality_repo.get_by_name.return_value = SimpleNamespace(id=uuid4())

    models = [
        create_mock_course(
            title="Course F",
            specialities=[create_mock_spec("Spec1", "Fac", type_kind=CourseTypeKind.COMPULSORY)],
            offerings=[
                create_mock_offering(
                    code="OFF001",
                    specialities=[
                        create_mock_spec("Spec1", "Fac", type_kind=CourseTypeKind.COMPULSORY)
                    ],
                )
            ],
        )
    ]

    with patch(
        "scraper.services.db_ingestion.injector.CourseOfferingSpeciality.objects"
    ) as mock_cos:
        mock_cos.update_or_create.return_value = (MagicMock(), True)

        injector.execute(models)

        # Assert - CourseOfferingSpeciality is created at the offering level
        assert mock_cos.update_or_create.call_count == 1
        call_kwargs = mock_cos.update_or_create.call_args.kwargs
        assert call_kwargs["offering"] == repo_mocks.course_offering
        assert call_kwargs["defaults"]["type_kind"] == "COMPULSORY"


@pytest.mark.django_db
def test_injector_skips_offering_speciality_when_not_in_cache(injector, repo_mocks):
    # Arrange — offering references a speciality not processed at course level → not in cache
    repo_mocks.speciality_repo.get_by_name.return_value = None

    models = [
        create_mock_course(
            title="Course G",
            specialities=[],
            offerings=[
                create_mock_offering(
                    code="OFF002",
                    specialities=[
                        create_mock_spec("UnknownSpec", "Fac", type_kind=CourseTypeKind.COMPULSORY)
                    ],
                )
            ],
        )
    ]

    with patch(
        "scraper.services.db_ingestion.injector.CourseOfferingSpeciality.objects"
    ) as mock_cos:
        mock_cos.update_or_create.return_value = (MagicMock(), True)

        injector.execute(models)

        mock_cos.update_or_create.assert_not_called()
