# This file is empty because we don't have any common services to inject yet
from rateukma.ioc.decorators import once

from ..constants import MAX_RATING_VALUE, MIN_RATING_VALUE
from ..filters.filters_parsers.course import CourseFilterParser
from ..models.choices import SemesterTerm


@once
def course_filter_parser() -> CourseFilterParser:
    return CourseFilterParser(
        min_rating=MIN_RATING_VALUE, max_rating=MAX_RATING_VALUE, semester_term_enum=SemesterTerm
    )
