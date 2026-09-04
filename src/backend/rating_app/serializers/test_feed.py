import datetime
import uuid
from decimal import Decimal

from rating_app.application_schemas.feed import FeedPage, FeedPromoItem, FeedReviewItem
from rating_app.models.choices import FeedPostAccent, SemesterTerm
from rating_app.serializers.feed import FeedPageSerializer

NOW = datetime.datetime(2026, 9, 1, 12, 0, tzinfo=datetime.UTC)


def _review(**overrides) -> FeedReviewItem:
    return FeedReviewItem(
        id=uuid.uuid4(),
        occurred_at=NOW,
        course_id=uuid.uuid4(),
        course_title="Дискретна математика",
        difficulty=4,
        usefulness=5,
        comment="Важко, але корисно",
        semester_year=2026,
        semester_term=SemesterTerm.FALL,
        course_avg_difficulty=Decimal("3.50"),
        course_avg_usefulness=Decimal("4.10"),
        **overrides,
    )


def _promo(**overrides) -> FeedPromoItem:
    return FeedPromoItem(
        id=uuid.uuid4(),
        occurred_at=NOW,
        title="Хакатон",
        body="Реєстрація відкрита",
        accent=FeedPostAccent.BRAND,
        **overrides,
    )


def _serialize(*items) -> list[dict]:
    return FeedPageSerializer(FeedPage(items=list(items))).data["items"]


def test_review_items_are_tagged_review():
    assert _serialize(_review())[0]["kind"] == "review"


def test_promo_items_are_tagged_promo():
    assert _serialize(_promo())[0]["kind"] == "promo"


def test_course_averages_serialize_as_numbers_not_strings():
    item = _serialize(_review())[0]

    assert item["course_avg_difficulty"] == 3.5
    assert item["course_avg_usefulness"] == 4.1


def test_review_items_carry_no_student_identity():
    item = _serialize(_review())[0]

    assert "student_id" not in item
    assert "student_name" not in item
    assert "is_anonymous" not in item


def test_mixed_page_serializes_each_kind_with_its_own_shape():
    items = _serialize(_review(), _promo())

    assert [item["kind"] for item in items] == ["review", "promo"]
    assert "course_title" in items[0]
    assert "title" in items[1]


def test_next_cursor_is_null_when_absent():
    assert FeedPageSerializer(FeedPage(items=[])).data["next_cursor"] is None
