import importlib
from types import SimpleNamespace

migration = importlib.import_module(
    "rating_app.migrations.0037_remove_courseoffering_co_credits_gt_0_and_more"
)


def test_backfill_maps_termless_offering_fields_to_term():
    offering = SimpleNamespace(
        pk="00000000-0000-0000-0000-000000000001",
        semester_id="00000000-0000-0000-0000-000000000002",
        credits="4.0",
        weekly_hours=3,
        lecture_count=28,
        practice_count=14,
        practice_type="SEMINAR",
        exam_type="EXAM",
    )

    kwargs = migration.build_term_kwargs(offering)

    assert kwargs == {
        "offering_id": "00000000-0000-0000-0000-000000000001",
        "semester_id": "00000000-0000-0000-0000-000000000002",
        "credits": "4.0",
        "weekly_hours": 3,
        "lecture_count": 28,
        "practice_count": 14,
        "practice_type": "SEMINAR",
        "exam_type": "EXAM",
    }
