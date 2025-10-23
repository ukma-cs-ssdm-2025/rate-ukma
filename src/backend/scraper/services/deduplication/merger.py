import structlog

from ...models import ParsedCourseDetails
from ...models.deduplicated import (
    DeduplicatedCourse,
    DeduplicatedCourseOffering,
)
from .base import DataValidationError, DeduplicationComponent
from .extractors import (
    CourseLimitsExtractor,
    CreditsExtractor,
    DescriptionExtractor,
    EducationLevelExtractor,
    ExamTypeExtractor,
    InstructorExtractor,
    PracticeTypeExtractor,
    RequiredFieldExtractor,
    SemesterExtractor,
    SpecialtyExtractor,
    StatusExtractor,
    StudentExtractor,
    WeeklyHoursExtractor,
)

logger = structlog.get_logger(__name__)


def _get_specialty_types_key(course: ParsedCourseDetails) -> tuple[str, ...]:
    return tuple(sorted(
        (spec.type.strip().lower() for spec in course.specialties or [])
    ))


def get_course_key(course: ParsedCourseDetails) -> tuple[str, str, str, tuple[str, ...], float]:
    title = course.title or ""
    faculty = course.faculty or ""
    department = course.department or ""
    specialty_types = _get_specialty_types_key(course)
    credits = course.credits or 0.0
    return (title.strip().lower(), faculty.strip().lower(), department.strip().lower(), specialty_types, credits)


class CourseMerger(DeduplicationComponent[list[ParsedCourseDetails], list[DeduplicatedCourse]]):
    def __init__(self):
        self.extractors = {
            "title": RequiredFieldExtractor("title"),
            "description": DescriptionExtractor(),
            "status": StatusExtractor(),
            "department": RequiredFieldExtractor("department"),
            "faculty": RequiredFieldExtractor("faculty"),
            "education_level": EducationLevelExtractor(),
            "specialities": SpecialtyExtractor(),
            "code": RequiredFieldExtractor("id"),
            "semester": SemesterExtractor(),
            "credits": CreditsExtractor(),
            "weekly_hours": WeeklyHoursExtractor(),
            "instructors": InstructorExtractor(),
            "enrollments": StudentExtractor(),
            "exam_type": ExamTypeExtractor(),
            "practice_type": PracticeTypeExtractor(),
            "limits": CourseLimitsExtractor(),
        }

    def process(self, data: list[ParsedCourseDetails]) -> list[DeduplicatedCourse]:
        return self.merge_duplicate_courses(data)

    def merge_duplicate_courses(
        self, all_courses: list[ParsedCourseDetails]
    ) -> list[DeduplicatedCourse]:
        from collections import defaultdict

        courses_by_key = defaultdict(list)
        for course in all_courses:
            key = get_course_key(course)
            courses_by_key[key].append(course)

        deduplicated_courses = []
        for key, courses in courses_by_key.items():
            try:
                if len(courses) == 1:
                    deduplicated = self._transform_single_course(courses[0])
                else:
                    deduplicated = self._merge_duplicate_courses(courses)
                deduplicated_courses.append(deduplicated)
            except Exception as e:
                logger.error(
                    "course_merge_failed",
                    key=key,
                    course_count=len(courses),
                    error=str(e),
                )
                raise DataValidationError(f"Failed to merge courses with key {key}: {e}") from e

        logger.info(
            "merger_completed",
            input_courses=len(all_courses),
            output_courses=len(deduplicated_courses),
            duplicates_found=sum(1 for courses in courses_by_key.values() if len(courses) > 1),
        )
        return deduplicated_courses

    def _transform_single_course(self, course: ParsedCourseDetails) -> DeduplicatedCourse:
        self._validate_course_for_transformation(course)

        offerings = self._transform_offerings([course])

        if not offerings:
            logger.warning(
                "no_offerings_created",
                course_id=course.id,
                course_title=course.title,
            )

        deduplicated = DeduplicatedCourse(
            title=self.extractors["title"].extract(course),
            description=self.extractors["description"].extract(course),
            status=self.extractors["status"].extract(course),
            department=self.extractors["department"].extract(course),
            faculty=self.extractors["faculty"].extract(course),
            education_level=self.extractors["education_level"].extract(course),
            specialities=self.extractors["specialities"].extract(course),
            offerings=offerings,
        )
        return deduplicated

    def _merge_duplicate_courses(self, courses: list[ParsedCourseDetails]) -> DeduplicatedCourse:
        if not courses:
            raise ValueError("Cannot merge empty course list")

        for course in courses:
            self._validate_course_for_transformation(course)

        base = courses[0]
        all_offerings = self._transform_offerings(courses)

        if not all_offerings:
            logger.warning(
                "no_merged_offerings_created",
                course_ids=[c.id for c in courses],
                course_title=base.title,
            )

        deduplicated = DeduplicatedCourse(
            title=self.extractors["title"].extract(base),
            description=self.extractors["description"].extract(base),
            status=self.extractors["status"].extract(base),
            department=self.extractors["department"].extract(base),
            faculty=self.extractors["faculty"].extract(base),
            education_level=self.extractors["education_level"].extract(base),
            specialities=self.extractors["specialities"].extract(base),
            offerings=all_offerings,
        )
        return deduplicated

    def _transform_offerings(
        self, courses: list[ParsedCourseDetails]
    ) -> list[DeduplicatedCourseOffering]:
        offerings = []
        for course in courses:
            semesters = self.extractors["semester"].extract(course)

            if not semesters:
                logger.warning(
                    "offering_creation_skipped",
                    reason="no_valid_semesters",
                    course_id=course.id,
                    course_title=course.title,
                )
                continue

            limits = self.extractors["limits"].extract(course)

            for semester in semesters:
                offering = DeduplicatedCourseOffering(
                    code=self.extractors["code"].extract(course),
                    semester=semester,
                    credits=self.extractors["credits"].extract(course),
                    weekly_hours=self.extractors["weekly_hours"].extract(course),
                    instructors=self.extractors["instructors"].extract(course),
                    enrollments=self.extractors["enrollments"].extract(course),
                    exam_type=self.extractors["exam_type"].extract(course),
                    practice_type=self.extractors["practice_type"].extract(course),
                    max_students=limits["max_students"],
                    max_groups=limits["max_groups"],
                    group_size_min=limits["group_size_min"],
                    group_size_max=limits["group_size_max"],
                )
                offerings.append(offering)

        return offerings

    def _validate_course_for_transformation(self, course: ParsedCourseDetails) -> None:
        # The TitleExtractor now handles title validation
        # We still need to validate academic_year for semester extraction
        if not course.academic_year:
            raise DataValidationError(f"Course {course.id} missing required academic_year")
