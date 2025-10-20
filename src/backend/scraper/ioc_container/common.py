from ..services.db_ingestion.composite import CoursesDeltaIngestion
from ..services.db_ingestion.file_reader import CourseFileReader
from ..services.db_ingestion.injector import CourseDbInjector


def course_file_reader() -> CourseFileReader:
    return CourseFileReader()


def course_db_injector() -> CourseDbInjector:
    return CourseDbInjector()


def courses_delta_ingestion() -> CoursesDeltaIngestion:
    return CoursesDeltaIngestion(
        [
            course_file_reader(),
            course_db_injector(),
        ]
    )
