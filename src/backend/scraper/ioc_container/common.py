from rating_app.ioc_container.repos import (
    course_instructor_repository,
    course_offering_repository,
    course_repository,
    department_repository,
    enrollment_repository,
    faculty_repository,
    instructor_repository,
    semester_repository,
    speciality_repository,
    student_repository,
)
from scraper.services.db_ingestion.progress_tracker import InjectionProgressTracker

from ..services.db_ingestion.composite import CoursesIngestion
from ..services.db_ingestion.file_reader import CoursesJSONLFileReader
from ..services.db_ingestion.injector import CourseDbInjector


def course_file_reader() -> CoursesJSONLFileReader:
    return CoursesJSONLFileReader()


def course_db_injector() -> CourseDbInjector:
    return CourseDbInjector(
        course_repository(),
        department_repository(),
        faculty_repository(),
        semester_repository(),
        speciality_repository(),
        instructor_repository(),
        student_repository(),
        course_offering_repository(),
        course_instructor_repository(),
        enrollment_repository(),
        injection_progress_tracker(),
    )


def courses_ingestion() -> CoursesIngestion:
    return CoursesIngestion(
        course_file_reader(),
        course_db_injector(),
    )


def injection_progress_tracker() -> InjectionProgressTracker:
    return InjectionProgressTracker()
