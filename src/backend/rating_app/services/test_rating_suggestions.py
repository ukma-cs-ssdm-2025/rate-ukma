from rating_app.services.rating_suggestions import (
    RatingSuggestion,
    SuggestionSemester,
    rank_rating_suggestions,
)


def candidate(course, offering, year, season, count):
    return RatingSuggestion(course, offering, course, SuggestionSemester(year, season), count)


def test_suggestions_prioritize_recency_then_underrepresented_courses():
    items = [
        candidate("old", "old-offering", 2024, "FALL", 0),
        candidate("popular", "popular-offering", 2025, "SPRING", 40),
        candidate("rare", "rare-offering", 2025, "SPRING", 1),
        candidate("latest", "latest-offering", 2025, "FALL", 20),
    ]
    assert [item.course_id for item in rank_rating_suggestions(items)] == [
        "latest",
        "rare",
        "popular",
    ]


def test_suggestions_deduplicate_courses_and_exclude_current_before_limiting():
    items = [
        candidate("repeat", "past", 2024, "FALL", 0),
        candidate("repeat", "latest", 2025, "SPRING", 0),
        candidate("current", "current", 2025, "FALL", 0),
        candidate("another", "another", 2025, "SPRING", 2),
    ]
    result = rank_rating_suggestions(items, exclude_course="current")
    assert [(item.course_id, item.course_offering_id) for item in result] == [
        ("repeat", "latest"),
        ("another", "another"),
    ]
