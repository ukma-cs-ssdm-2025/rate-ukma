from rating_app.application_schemas import ukma_data_api as ud

OFFERING = {
    "id": "o-1",
    "courseId": "c-1",
    "sazCode": "TST-0001",
    "academicYear": 2030,
    "title": "Вступ до вигаданих наук",
    "facultyId": "f-1",
    "departmentId": "d-1",
    "level": "bachelor",
    "format": "очна",
    "credits": 4,
    "hours": 120,
    "studyYear": 2,
    "status": "held",
    "isPractical": False,
    "annotation": None,
    "maxStudents": 30,
    "maxGroups": 2,
    "computedMaxStudents": 30,
    "groupSizeMin": 10,
    "groupSizeMax": 15,
    "enrolledActive": 21,
    "terms": [
        {
            "termId": "t-1",
            "semesters": [1],
            "credits": 4,
            "hoursPerWeek": 3,
            "lectureHours": 28,
            "seminarHours": 14,
            "practiceHours": None,
            "control": "exam",
        }
    ],
    "programmes": [{"programmeId": "p-1", "kind": "elective"}],
    "changeNo": 5,
    "removedAt": None,
}


def test_parses_a_camel_case_offering_from_ukma_data():
    offering = ud.Offering.model_validate(OFFERING)

    assert offering.saz_code == "TST-0001"
    assert offering.course_id == "c-1"
    assert offering.terms[0].control is ud.Control.exam
    assert offering.programmes[0].kind is ud.Kind2.elective
    assert offering.model_dump(by_alias=True)["sazCode"] == "TST-0001"


def test_reads_generated_models_by_snake_case_field_names():
    term = ud.Term(
        id="t-1", code="2030-FALL", academic_year=2030, season=ud.Season.fall, change_no=1
    )

    assert term.academic_year == 2030
    assert term.model_dump(by_alias=True) == {
        "id": "t-1",
        "code": "2030-FALL",
        "academicYear": 2030,
        "season": "FALL",
        "changeNo": 1,
    }
