from faker import Faker

from scraper.models import Enrollment, Limits, ParsedCourseDetails, SpecialtyEntry, StudentRow
from scraper.parsers.course import (
    CourseDetailParser,
    EnrollmentParser,
    ParserUtils,
    SpecialtyParser,
    StudentsParser,
)

fake = Faker()


# ParserUtils tests
def test_clean_text_with_normal_text():
    input_text = f"  {fake.sentence()}   {fake.word()}  "
    expected = " ".join(input_text.split()).strip()

    result = ParserUtils.clean_text(input_text)

    assert result == expected


def test_clean_text_with_none():
    assert ParserUtils.clean_text(None) == ""


def test_clean_text_with_multiple_newlines_and_tabs():
    word1, word2, word3 = fake.word(), fake.word(), fake.word()
    input_text = f"{word1}\n\n\t{word2}\n{word3}"
    expected = f"{word1} {word2} {word3}"

    result = ParserUtils.clean_text(input_text)

    assert result == expected


def test_parse_int_with_valid_string():
    number = fake.random_int(min=1, max=100)
    input_text = f"There are {number} students"

    result = ParserUtils.parse_int(input_text)

    assert result == number


def test_parse_int_with_no_digits():
    assert ParserUtils.parse_int("No numbers here") is None


def test_parse_int_with_empty_string():
    assert ParserUtils.parse_int("") is None


def test_parse_int_with_none():
    assert ParserUtils.parse_int(None) is None


def test_parse_int_with_multiple_numbers():
    number1, number2 = fake.random_int(min=1, max=100), fake.random_int(min=1, max=100)
    input_text = f"There are {number1} students and {number2} teachers"

    result = ParserUtils.parse_int(input_text)

    assert result == number1


def test_parse_float_with_valid_float():
    number = round(fake.random.uniform(1, 5), 1)
    input_text = f"Rating: {number} out of 5"

    result = ParserUtils.parse_float(input_text)

    assert result == number


def test_parse_float_with_comma_separator():
    integer_part = fake.random_int(min=1, max=9)
    decimal_part = fake.random_int(min=0, max=99)
    expected = float(f"{integer_part}.{decimal_part:02d}")
    input_text = f"Score: {integer_part},{decimal_part:02d}"

    result = ParserUtils.parse_float(input_text)

    assert result == expected


def test_parse_float_with_integer():
    integer = fake.random_int(min=1, max=100)
    input_text = f"Value: {integer}"

    result = ParserUtils.parse_float(input_text)

    assert result == float(integer)


def test_parse_float_with_no_numbers():
    assert ParserUtils.parse_float("No numbers") is None


def test_parse_float_with_empty_string():
    assert ParserUtils.parse_float("") is None


def test_parse_float_with_none():
    assert ParserUtils.parse_float(None) is None


# SpecialtyParser tests
def test_specialty_parser_with_valid_specialty_table():
    specialty_1, specialty_2 = fake.job(), fake.job()
    type_1, type_2 = fake.word(), fake.word()

    html = f"""
    <html>
        <body>
            <div id="course--spec">
                <table>
                    <tbody>
                        <tr>
                            <td>{specialty_1}</td>
                            <td>{type_1}</td>
                        </tr>
                        <tr>
                            <td>{specialty_2}</td>
                            <td>{type_2}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </body>
    </html>
    """
    expected = [
        SpecialtyEntry(specialty=specialty_1, type=type_1),
        SpecialtyEntry(specialty=specialty_2, type=type_2),
    ]

    result = SpecialtyParser().parse(html)

    assert result == expected


def test_specialty_parser_with_no_specialty_table():
    result = SpecialtyParser().parse("<html><body><p>No specialties</p></body></html>")
    assert result == []


def test_specialty_parser_with_incomplete_table_row():
    specialty, type_name = fake.job(), fake.word()

    html = f"""
    <html>
        <body>
            <div id="course--spec">
                <table>
                    <tbody>
                        <tr>
                            <td>Only one column</td>
                        </tr>
                        <tr>
                            <td>{specialty}</td>
                            <td>{type_name}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </body>
    </html>
    """
    expected = [SpecialtyEntry(specialty=specialty, type=type_name)]

    result = SpecialtyParser().parse(html)

    assert result == expected


# EnrollmentParser tests
def test_enrollment_parser_limits_with_valid_data():
    max_students = fake.random_int(min=20, max=100)
    max_groups = fake.random_int(min=2, max=10)
    group_min, group_max = fake.random_int(min=3, max=10), fake.random_int(min=11, max=20)
    computed_max = fake.random_int(min=50, max=200)

    html = f"""
    <table>
        <tr>
            <th>Максимальна кількість студентів</th>
            <td>{max_students}</td>
        </tr>
        <tr>
            <th>Максимальна кількість груп</th>
            <td>{max_groups}</td>
        </tr>
        <tr>
            <th>Кількість студентів в групі</th>
            <td>від {group_min} до {group_max}</td>
        </tr>
        <tr>
            <th>Обрахована максимальна кількість студентів</th>
            <td>{computed_max}</td>
        </tr>
    </table>
    """
    expected = Limits(
        max_students=max_students,
        max_groups=max_groups,
        group_size_min=group_min,
        group_size_max=group_max,
        computed_max_students=computed_max,
    )

    result = EnrollmentParser().parse_limits(html)

    assert result == expected


def test_enrollment_parser_with_valid_data():
    free_places = f"{fake.random_int(min=1, max=20)} місць"
    enrolled_active = fake.random_int(min=20, max=50)
    approved_enrolled = fake.random_int(min=15, max=45)
    approved_groups = fake.random_int(min=2, max=8)
    can_add_students = fake.random_int(min=5, max=25)

    html = f"""
    <table>
        <tr>
            <th>Кількість вільних місць</th>
            <td>{free_places}</td>
        </tr>
        <tr>
            <th>Загальна кількість записаних чинних студентів</th>
            <td>{enrolled_active}</td>
        </tr>
        <tr>
            <th>Кількість чинних студентів у затверджених групах</th>
            <td>{approved_enrolled}</td>
        </tr>
        <tr>
            <th>Кількість затверджених груп</th>
            <td>{approved_groups}</td>
        </tr>
        <tr>
            <th>Можна добрати студентів в групи</th>
            <td>{can_add_students}</td>
        </tr>
    </table>
    """
    expected = Enrollment(
        free_places=free_places,
        enrolled_active=enrolled_active,
        approved_enrolled=approved_enrolled,
        approved_groups=approved_groups,
        can_add_students_to_groups=can_add_students,
    )

    result = EnrollmentParser().parse(html)

    assert result == expected


def test_enrollment_parser_with_empty_data():
    result = EnrollmentParser().parse("<table></table>")
    assert result == Enrollment()


# StudentsParser tests
def test_students_parser_with_caption_table():
    name_1, name_2 = fake.name(), fake.name()
    html = f"""
    <table>
        <caption>Перелік студентів</caption>
        <tbody>
            <tr>
                <td>1</td>
                <td>{name_1}</td>
                <td>Computer Science</td>
                <td>Bachelor</td>
                <td>Full-time</td>
                <td>Morning</td>
                <td>Active</td>
                <td>CS101</td>
                <td>{fake.email()}</td>
            </tr>
            <tr>
                <td>2</td>
                <td>{name_2}</td>
                <td>Data Science</td>
                <td>Master</td>
                <td>Part-time</td>
                <td>Evening</td>
                <td>Active</td>
                <td>DS201</td>
                <td>{fake.email()}</td>
            </tr>
        </tbody>
    </table>
    """

    result = StudentsParser().parse(html)

    assert len(result) == 2
    assert result[0].index == "1"
    assert result[0].name == name_1
    assert result[1].index == "2"
    assert result[1].name == name_2


def test_students_parser_with_course_student_rows():
    name = fake.name()
    email = fake.email()

    html = f"""
    <tr class="course-student-list-row">
        <td>1</td>
        <td>{name}</td>
        <td>3</td>
        <td>CS</td>
        <td>Full-time</td>
        <td>Morning</td>
        <td>Active</td>
        <td>CS101</td>
        <td>{email}</td>
    </tr>
    """
    expected = [
        StudentRow(
            index="1",
            name=name,
            course="3",
            specialty="CS",
            type="Full-time",
            time="Morning",
            status="Active",
            group="CS101",
            email=email,
        )
    ]

    result = StudentsParser().parse(html)

    assert result == expected


def test_students_parser_with_no_students():
    result = StudentsParser().parse("<table><tbody></tbody></table>")
    assert result == []


def test_course_detail_parser_with_basic_course_info():
    title = fake.catch_phrase()
    course_id = f"{fake.random_letter().upper()}{fake.random_int(min=100, max=999)}"
    credits = fake.random_int(min=1, max=6)
    hours = fake.random_int(min=15, max=180)
    year = fake.random_int(min=1, max=6)
    format_type = fake.word()
    status = f"Курс {fake.word()}"
    url = fake.url()

    html = f"""
    <html>
        <body>
            <div class="page-header">
                <h1>{title}</h1>
            </div>
            <table class="table table-condensed table-bordered">
                <tbody>
                    <tr>
                        <th title="Код курсу">Код</th>
                        <td>{course_id}</td>
                    </tr>
                    <tr>
                        <th>Інформація</th>
                        <td>
                            <span class="label">{credits} кред</span>
                            <span class="label">{hours} год.</span>
                            <span class="label">{year} рік</span>
                            <span class="label">Формат {format_type}</span>
                            <span class="label">{status}</span>
                        </td>
                    </tr>
                </tbody>
            </table>
        </body>
    </html>
    """

    result = CourseDetailParser().parse(html, url=url)

    assert result.url == url
    assert result.title == title
    assert result.id == course_id
    assert result.credits == float(credits)
    assert result.hours == hours
    assert result.year == year
    assert result.format == format_type
    assert result.status == status


def test_course_detail_parser_with_missing_table():
    url = fake.url()
    title = fake.catch_phrase()

    html = f"""
    <html>
        <body>
            <div class="page-header">
                <h1>{title}</h1>
            </div>
        </body>
    </html>
    """

    result = CourseDetailParser().parse(html, url=url)

    assert result.url == url
    assert result.title == title
    assert result.id is None
    assert result.credits is None
    assert result.hours is None
    assert result.year is None
    assert result.format is None
    assert result.status is None


def test_course_detail_parser_with_partial_info():
    url = fake.url()
    title = fake.catch_phrase()
    course_id = f"{fake.random_letter().upper()}{fake.random_int(min=100, max=999)}"

    html = f"""
    <html>
        <body>
            <div class="page-header">
                <h1>{title}</h1>
            </div>
            <table class="table table-condensed table-bordered">
                <tbody>
                    <tr>
                        <th title="Код курсу">Код</th>
                        <td>{course_id}</td>
                    </tr>
                </tbody>
            </table>
        </body>
    </html>
    """

    result = CourseDetailParser().parse(html, url=url)

    assert result.url == url
    assert result.title == title
    assert result.id == course_id
    assert result.credits is None
    assert result.hours is None
    assert result.year is None
    assert result.format is None
    assert result.status is None
    assert result.specialties == []
    assert result.annotation is None


def test_course_detail_parser_with_no_tbody():
    url = fake.url()

    html = """
    <html>
        <body>
            <div class="page-header">
                <h1>Course Title</h1>
            </div>
            <table class="table table-condensed table-bordered">
            </table>
        </body>
    </html>
    """

    result = CourseDetailParser().parse(html, url=url)

    assert result.url == url
    assert result.title == "Course Title"
    assert result.id is None
    assert result.credits is None
    assert result.hours is None
    assert result.year is None
    assert result.format is None
    assert result.status is None


def test_course_detail_parser_with_minimal_html():
    url = fake.url()
    expected = ParsedCourseDetails(url=url)

    result = CourseDetailParser().parse("<html><body></body></html>", url=url)

    assert result.url == expected.url
    assert result.title == ""
    assert result.id is None


def test_enrollment_parser_with_malformed_numbers():
    html = """
    <table>
        <tr>
            <th>Кількість вільних місць</th>
            <td>немає місць</td>
        </tr>
        <tr>
            <th>Загальна кількість записаних чинних студентів</th>
            <td>не вказано</td>
        </tr>
        <tr>
            <th>Кількість чинних студентів у затверджених групах</th>
            <td>~25</td>
        </tr>
        <tr>
            <th>Кількість затверджених груп</th>
            <td>багато</td>
        </tr>
        <tr>
            <th>Можна добрати студентів в групи</th>
            <td>майже немає</td>
        </tr>
    </table>
    """

    result = EnrollmentParser().parse(html)

    assert result.free_places == "немає місць"
    assert result.enrolled_active is None
    assert result.approved_enrolled == 25
    assert result.approved_groups is None
    assert result.can_add_students_to_groups is None


def test_enrollment_parser_with_zero_values():
    html = """
    <table>
        <tr>
            <th>Кількість вільних місць</th>
            <td>0 місць</td>
        </tr>
        <tr>
            <th>Загальна кількість записаних чинних студентів</th>
            <td>0</td>
        </tr>
        <tr>
            <th>Кількість чинних студентів у затверджених групах</th>
            <td>0</td>
        </tr>
        <tr>
            <th>Кількість затверджених груп</th>
            <td>0</td>
        </tr>
        <tr>
            <th>Можна добрати студентів в групи</th>
            <td>0</td>
        </tr>
    </table>
    """

    result = EnrollmentParser().parse(html)

    assert result.free_places == "0 місць"
    assert result.enrolled_active == 0
    assert result.approved_enrolled == 0
    assert result.approved_groups == 0
    assert result.can_add_students_to_groups == 0


def test_enrollment_parser_limits_with_partial_data():
    max_students = fake.random_int(min=20, max=100)
    max_groups = fake.random_int(min=2, max=10)

    html = f"""
    <table>
        <tr>
            <th>Максимальна кількість студентів</th>
            <td>{max_students}</td>
        </tr>
        <tr>
            <th>Максимальна кількість груп</th>
            <td>{max_groups}</td>
        </tr>
        <tr>
            <th>Кількість студентів в групі</th>
            <td>не вказано</td>
        </tr>
    </table>
    """

    result = EnrollmentParser().parse_limits(html)

    assert result.max_students == max_students
    assert result.max_groups == max_groups
    assert result.group_size_min is None
    assert result.group_size_max is None
    assert result.computed_max_students is None


def test_enrollment_parser_with_different_number_formats():
    html = """
    <table>
        <tr>
            <th>Кількість вільних місць</th>
            <td>15 місць</td>
        </tr>
        <tr>
            <th>Загальна кількість записаних чинних студентів</th>
            <td>42 студента</td>
        </tr>
        <tr>
            <th>Кількість чинних студентів у затверджених групах</th>
            <td>30 осіб</td>
        </tr>
        <tr>
            <th>Кількість затверджених груп</th>
            <td>5 груп</td>
        </tr>
        <tr>
            <th>Можна добрати студентів в групи</th>
            <td>12 людей</td>
        </tr>
    </table>
    """

    result = EnrollmentParser().parse(html)

    assert result.free_places == "15 місць"
    assert result.enrolled_active == 42
    assert result.approved_enrolled == 30
    assert result.approved_groups == 5
    assert result.can_add_students_to_groups == 12
