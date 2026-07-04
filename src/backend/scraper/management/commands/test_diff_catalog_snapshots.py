from scraper.management.commands.diff_catalog_snapshots import diff_sections, render_report


def test_diff_sections_identical_snapshots():
    snapshot = {"courses": {"a|dep|BP": {"status": "ANNOUNCED"}}}

    diff = diff_sections(snapshot, snapshot)

    assert diff["courses"] == {"added": [], "removed": [], "changed": {}}


def test_diff_sections_added_removed_changed():
    before = {
        "courses": {
            "kept|dep|BP": {"status": "ANNOUNCED"},
            "gone|dep|BP": {"status": "ANNOUNCED"},
        }
    }
    after = {
        "courses": {
            "kept|dep|BP": {"status": "CONDUCTED"},
            "new|dep|BP": {"status": "ANNOUNCED"},
        }
    }

    diff = diff_sections(before, after)

    assert diff["courses"]["added"] == ["new|dep|BP"]
    assert diff["courses"]["removed"] == ["gone|dep|BP"]
    assert diff["courses"]["changed"] == {
        "kept|dep|BP": {"status": {"before": "ANNOUNCED", "after": "CONDUCTED"}}
    }


def test_diff_sections_handles_missing_section():
    diff = diff_sections({}, {"faculties": {"FI": {}}})

    assert diff["faculties"]["added"] == ["FI"]


def test_render_report_contains_summary_and_details():
    diff = diff_sections(
        {"faculties": {"FI": {}}},
        {"faculties": {"FI": {}, "FEN": {}}},
    )

    report = render_report(diff, full=False)

    assert "| faculties | 1 | 0 | 0 |" in report
    assert "- FEN" in report
