from dataclasses import dataclass


@dataclass
class CourseAnalyticsDTO:
    id: str  # UUID as string
    avg_usefulness: float
    avg_difficulty: float
    ratings_count: int
    name: str
    faculty_name: str | None = None
