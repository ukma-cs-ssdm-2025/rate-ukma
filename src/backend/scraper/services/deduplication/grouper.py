import structlog

from ...models import ParsedCourseDetails
from ...models.deduplicated import (
    DeduplicatedCourse,
    DeduplicatedCourseOffering,
    DeduplicatedCourseOfferingTerm,
    ExamType,
    PracticeType,
    SemesterTerm,
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
)

logger = structlog.get_logger(__name__)


def _normalize_specialty_for_grouping(specialties) -> str:
    if not specialties:
        return ""

    specialty_parts = []
    for spec in specialties:
        if hasattr(spec, "specialty") and hasattr(spec, "type"):
            specialty_name = spec.specialty
            specialty_type = spec.type
        elif isinstance(spec, dict):
            specialty_name = spec.get("specialty", "")
            specialty_type = spec.get("type", "")
        else:
            continue

        if specialty_name:
            normalized_name = str(specialty_name).strip().lower()
            if specialty_type:
                normalized_type = str(specialty_type).strip().lower()
                specialty_parts.append(f"{normalized_name} ({normalized_type})")
            else:
                specialty_parts.append(normalized_name)

    return " | ".join(sorted(specialty_parts))


def get_course_grouping_key(course: ParsedCourseDetails) -> tuple[str, str, str, str]:
    title = (course.title or "").strip().lower()
    faculty = (course.faculty or "").strip().lower()
    specialty_info = _normalize_specialty_for_grouping(course.specialties or [])
    education_level = (course.education_level or "").strip().lower()

    return (title, faculty, specialty_info, education_level)


class CourseGrouper(DeduplicationComponent[list[ParsedCourseDetails], list[DeduplicatedCourse]]):
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
            "instructors": InstructorExtractor(),
            "enrollments": StudentExtractor(),
            "exam_type": ExamTypeExtractor(),
            "practice_type": PracticeTypeExtractor(),
            "limits": CourseLimitsExtractor(),
        }

    def process(self, data: list[ParsedCourseDetails]) -> list[DeduplicatedCourse]:
        return self.group_course_offerings(data)

    def group_course_offerings(
        self, all_courses: list[ParsedCourseDetails]
    ) -> list[DeduplicatedCourse]:
        from collections import defaultdict

        valid_courses = []
        filtered_out_count = 0

        for course in all_courses:
            course_credits = course.credits
            course_hours = course.hours

            if course_credits is not None and course_credits <= 0:
                logger.debug(
                    "filtering_course_zero_credits",
                    course_id=course.id,
                    course_title=course.title,
                    credits=course_credits,
                )
                filtered_out_count += 1
                continue

            if course_hours is not None and course_hours <= 0:
                logger.debug(
                    "filtering_course_zero_hours",
                    course_id=course.id,
                    course_title=course.title,
                    hours=course_hours,
                )
                filtered_out_count += 1
                continue

            valid_courses.append(course)

        if filtered_out_count > 0:
            logger.info(
                "courses_filtered_out",
                filtered_count=filtered_out_count,
                original_count=len(all_courses),
                remaining_count=len(valid_courses),
                reason="zero_credits_or_hours",
            )

        courses_by_key = defaultdict(list)
        for course in valid_courses:
            key = get_course_grouping_key(course)
            courses_by_key[key].append(course)

        grouped_courses = []
        for key, courses in courses_by_key.items():
            try:
                if len(courses) == 1:
                    grouped = self._transform_single_course(courses[0])
                else:
                    grouped = self._group_course_offerings(courses)
                grouped_courses.append(grouped)
            except Exception as e:
                logger.error(
                    "course_grouping_failed",
                    key=key,
                    course_count=len(courses),
                    error=str(e),
                )
                raise DataValidationError(f"Failed to group courses with key {key}: {e}") from e

        logger.info(
            "grouping_completed",
            input_courses=len(valid_courses),
            original_input_count=len(all_courses),
            output_courses=len(grouped_courses),
            groups_found=sum(1 for courses in courses_by_key.values() if len(courses) > 1),
        )
        return grouped_courses

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

    def _group_course_offerings(self, courses: list[ParsedCourseDetails]) -> DeduplicatedCourse:
        if not courses:
            raise ValueError("Cannot group empty course list")

        for course in courses:
            self._validate_course_for_transformation(course)

        base = courses[0]
        all_offerings = self._transform_offerings(courses)

        if not all_offerings:
            logger.warning(
                "no_grouped_offerings_created",
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

            course_specialities = self.extractors["specialities"].extract(course)
            term_details = self._build_term_details(course, semesters)
            if not term_details:
                logger.warning(
                    "offering_creation_skipped",
                    reason="no_valid_term_details",
                    course_id=course.id,
                    course_title=course.title,
                )
                continue

            representative_term = self._select_representative_term(term_details)
            representative_details = representative_term["details"]
            representative_semester = representative_term["semester"]

            offering = DeduplicatedCourseOffering(
                code=self.extractors["code"].extract(course),
                semester=representative_semester,
                credits=self._resolve_total_offering_credits(course, term_details),
                weekly_hours=representative_details["weekly_hours"],
                study_year=course.year,
                instructors=self.extractors["instructors"].extract(course),
                enrollments=self.extractors["enrollments"].extract(course),
                exam_type=representative_details["exam_type"],
                lecture_count=representative_details["lecture_count"],
                practice_count=representative_details["practice_count"],
                practice_type=representative_details["practice_type"],
                max_students=limits["max_students"],
                max_groups=limits["max_groups"],
                group_size_min=limits["group_size_min"],
                group_size_max=limits["group_size_max"],
                specialities=course_specialities,
                terms=[
                    DeduplicatedCourseOfferingTerm(
                        semester=item["semester"],
                        credits=item["details"]["credits"],
                        weekly_hours=item["details"]["weekly_hours"],
                        lecture_count=item["details"]["lecture_count"],
                        practice_count=item["details"]["practice_count"],
                        practice_type=item["details"]["practice_type"],
                        exam_type=item["details"]["exam_type"],
                    )
                    for item in term_details
                ],
            )
            offerings.append(offering)

        return offerings

    def _build_term_details(
        self,
        course: ParsedCourseDetails,
        semesters,
    ) -> list[dict[str, object]]:
        term_details: list[dict[str, object]] = []
        for semester in semesters:
            offering_details = self._build_offering_details(course, semester)
            term_credits = offering_details["credits"]

            if term_credits is None or term_credits <= 0:
                logger.warning(
                    "offering_term_creation_skipped",
                    reason="invalid_offering_credits",
                    course_id=course.id,
                    course_title=course.title,
                    semester_term=semester.term.value,
                    semester_year=semester.year,
                    credits=term_credits,
                )
                continue

            term_details.append(
                {
                    "semester": semester,
                    "details": offering_details,
                }
            )

        return term_details

    def _select_representative_term(self, term_details: list[dict[str, object]]) -> dict[str, object]:
        return max(
            term_details,
            key=lambda item: (
                item["semester"].year,
                self._term_rank(item["semester"].term),
            ),
        )

    def _term_rank(self, term: SemesterTerm) -> int:
        return {
            SemesterTerm.FALL: 1,
            SemesterTerm.SPRING: 2,
            SemesterTerm.SUMMER: 3,
        }.get(term, 0)

    def _resolve_total_offering_credits(
        self,
        course: ParsedCourseDetails,
        term_details: list[dict[str, object]],
    ) -> float:
        total_credits = self.extractors["credits"].extract(course)
        if total_credits and total_credits > 0:
            return total_credits

        return float(sum(item["details"]["credits"] for item in term_details))

    def _validate_course_for_transformation(self, course: ParsedCourseDetails) -> None:
        if not course.academic_year:
            raise DataValidationError(f"Course {course.id} missing required academic_year")

    def _build_offering_details(
        self,
        course: ParsedCourseDetails,
        semester,
    ) -> dict[str, object]:
        season_info = self._get_season_info(course, semester.term)
        course_credits = self.extractors["credits"].extract(course)
        season_credits = season_info.credits if season_info else None

        resolved_credits = (
            season_credits
            if season_credits is not None and season_credits > 0
            else course_credits
        )
        weekly_hours = (
            season_info.hours_per_week
            if season_info and season_info.hours_per_week is not None
            else 0
        )
        exam_type = (
            self._map_exam_type(season_info.exam_type)
            if season_info and season_info.exam_type
            else self.extractors["exam_type"].extract(course)
        )
        practice_type = (
            self._map_practice_type(season_info.practice_type)
            if season_info and season_info.practice_type
            else self.extractors["practice_type"].extract(course)
        )

        return {
            "credits": resolved_credits,
            "weekly_hours": weekly_hours,
            "lecture_count": season_info.lecture_hours if season_info else None,
            "practice_count": season_info.practice_hours if season_info else None,
            "exam_type": exam_type,
            "practice_type": practice_type,
        }

    def _get_season_info(self, course: ParsedCourseDetails, term: SemesterTerm):
        if not course.season_details:
            return None

        term_key_map = {
            SemesterTerm.FALL: "осін",
            SemesterTerm.SPRING: "вес",
            SemesterTerm.SUMMER: "літ",
        }
        expected_fragment = term_key_map.get(term)
        if expected_fragment is None:
            return None

        for season_key, season_info in course.season_details.items():
            if expected_fragment in season_key.lower():
                return season_info

        return None

    def _map_exam_type(self, raw_exam_type: str) -> ExamType:
        normalized = raw_exam_type.strip().lower().replace("`", "'")
        if "залік" in normalized:
            return ExamType.CREDIT
        if "екзам" in normalized or "іспит" in normalized:
            return ExamType.EXAM
        return ExamType.EXAM

    def _map_practice_type(self, raw_practice_type: str) -> PracticeType:
        normalized = raw_practice_type.strip().upper()
        if normalized == "SEMINAR":
            return PracticeType.SEMINAR
        return PracticeType.PRACTICE
