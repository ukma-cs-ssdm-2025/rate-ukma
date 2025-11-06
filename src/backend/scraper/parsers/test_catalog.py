from faker import Faker

from scraper.parsers.catalog import (
    CatalogParser,
    CourseLinkParser,
    extract_course_ids,
    parse_catalog_page,
)
from scraper.parsers.course import (
    CourseDetailParser,
    SpecialtyParser,
    StudentsParser,
)

fake = Faker()


def test_course_link_parser_with_valid_html():
    course_id_1, course_id_2 = fake.random_int(min=100, max=999), fake.random_int(min=100, max=999)
    base_url = fake.url().rstrip("/")

    html = f"""
    <html>
        <body>
            <a href="/course/{course_id_1}">Course {course_id_1}</a>
            <a href="/course/{course_id_2}">Course {course_id_2}</a>
            <a href="/other/page">Other</a>
        </body>
    </html>
    """
    expected = [f"{base_url}/course/{course_id_1}", f"{base_url}/course/{course_id_2}"]

    result = CourseLinkParser().parse(html, base_url=base_url)

    assert result == expected


def test_course_link_parser_with_no_course_links():
    html = """
    <html>
        <body>
            <a href="/other/page">Other</a>
            <a href="/another/page">Another</a>
        </body>
    </html>
    """

    result = CourseLinkParser().parse(html, base_url=fake.url())

    assert result == []


def test_extract_course_ids_with_valid_html():
    course_id_1, course_id_2 = (
        str(fake.random_int(min=100, max=999)),
        str(fake.random_int(min=100, max=999)),
    )

    html = f"""
    <html>
        <body>
            <a href="/course/{course_id_1}">Course {course_id_1}</a>
            <a href="/course/{course_id_2}">Course {course_id_2}</a>
            <a href="/course/{course_id_1}">Duplicate</a>
        </body>
    </html>
    """
    expected = sorted([course_id_1, course_id_2])

    result = CourseLinkParser().extract_course_ids(html)

    assert sorted(result) == expected


def test_extract_course_ids_with_no_course_links():
    html = f'''
    <html>
        <body>
            <a href="{fake.url()}">Other</a>
        </body>
    </html>
    '''

    result = CourseLinkParser().extract_course_ids(html)

    assert result == []


def test_extract_course_ids_handles_malformed_links():
    html = """
    <html>
        <body>
            <a href="/course/invalid">Invalid</a>
            <a href="/course/">Empty</a>
            <a href="invalid">Malformed</a>
        </body>
    </html>
    """

    result = CourseLinkParser().extract_course_ids(html)

    assert result == []


def test_catalog_parser_with_valid_html():
    course_id_1, course_id_2 = fake.random_int(min=100, max=999), fake.random_int(min=100, max=999)
    base_url = fake.url().rstrip("/")
    last_page = fake.random_int(min=5, max=50)

    html = f"""
    <html>
        <body>
            <a href="/course/{course_id_1}">Course {course_id_1}</a>
            <a href="/course/{course_id_2}">Course {course_id_2}</a>
            <ul class="pagination">
                <li class="last"><a href="?page={last_page}">Last</a></li>
            </ul>
        </body>
    </html>
    """
    expected_links = [f"{base_url}/course/{course_id_1}", f"{base_url}/course/{course_id_2}"]

    result_links, result_last_page = CatalogParser().parse(html, base_url=base_url)

    assert result_links == expected_links
    assert result_last_page == last_page


def test_catalog_parser_with_no_pagination():
    course_id = fake.random_int(min=100, max=999)
    base_url = fake.url().rstrip("/")

    html = f"""
    <html>
        <body>
            <a href="/course/{course_id}">Course {course_id}</a>
        </body>
    </html>
    """
    expected_links = [f"{base_url}/course/{course_id}"]

    result_links, result_last_page = CatalogParser().parse(html, base_url=base_url)

    assert result_links == expected_links
    assert result_last_page is None


def test_parse_catalog_page_function():
    course_id_1, course_id_2 = fake.random_int(min=100, max=999), fake.random_int(min=100, max=999)
    base_url = fake.url().rstrip("/")
    last_page = fake.random_int(min=5, max=50)

    html = f"""
    <html>
        <body>
            <a href="/course/{course_id_1}">Course {course_id_1}</a>
            <a href="/course/{course_id_2}">Course {course_id_2}</a>
            <ul class="pagination">
                <li class="last"><a href="?page={last_page}">Last</a></li>
            </ul>
        </body>
    </html>
    """
    expected_links = [f"{base_url}/course/{course_id_1}", f"{base_url}/course/{course_id_2}"]

    result_links, result_last_page = parse_catalog_page(base_url, html)

    assert result_links == expected_links
    assert result_last_page == last_page


def test_extract_course_ids_function():
    course_id_1, course_id_2 = (
        str(fake.random_int(min=100, max=999)),
        str(fake.random_int(min=100, max=999)),
    )

    html = f"""
    <html>
        <body>
            <a href="/course/{course_id_1}">Course {course_id_1}</a>
            <a href="/course/{course_id_2}">Course {course_id_2}</a>
            <a href="/course/{course_id_1}">Duplicate</a>
        </body>
    </html>
    """
    expected = [course_id_1, course_id_2]

    result = extract_course_ids(html)

    assert set(result) == set(expected)


def test_catalog_parser_pagination_with_query_string():
    course_id = fake.random_int(min=100, max=999)
    base_url = fake.url().rstrip("/")
    last_page = fake.random_int(min=5, max=50)

    html = f"""
    <html>
        <body>
            <a href="/course/{course_id}">Course {course_id}</a>
            <ul class="pagination">
                <li class="last"><a href="?page={last_page}">Last</a></li>
            </ul>
        </body>
    </html>
    """

    result_links, result_last_page = CatalogParser().parse(html, base_url=base_url)

    assert result_links == [f"{base_url}/course/{course_id}"]
    assert result_last_page == last_page


def test_catalog_parser_pagination_with_data_page():
    course_id = fake.random_int(min=100, max=999)
    base_url = fake.url().rstrip("/")
    data_page = fake.random_int(min=1, max=10)
    expected_last_page = data_page + 1

    html = f'''
    <html>
        <body>
            <a href="/course/{course_id}">Course {course_id}</a>
            <ul class="pagination">
                <li class="last"><a href="#" data-page="{data_page}">Last</a></li>
            </ul>
        </body>
    </html>
    '''

    result_links, result_last_page = CatalogParser().parse(html, base_url=base_url)

    assert result_links == [f"{base_url}/course/{course_id}"]
    assert result_last_page == expected_last_page


def test_catalog_parser_pagination_with_numeric_links():
    course_id = fake.random_int(min=100, max=999)
    base_url = fake.url().rstrip("/")
    pages = [fake.random_int(min=1, max=5) for _ in range(3)]
    max_page = max(pages)

    page_links = "".join([f'<li><a href="?page={p}">{p}</a></li>' for p in pages])

    html = f"""
    <html>
        <body>
            <a href="/course/{course_id}">Course {course_id}</a>
            <ul class="pagination">
                {page_links}
            </ul>
        </body>
    </html>
    """

    result_links, result_last_page = CatalogParser().parse(html, base_url=base_url)

    assert result_links == [f"{base_url}/course/{course_id}"]
    assert result_last_page == max_page


def test_catalog_parser_malformed_pagination():
    course_id = fake.random_int(min=100, max=999)
    base_url = fake.url().rstrip("/")

    html = f"""
    <html>
        <body>
            <a href="/course/{course_id}">Course {course_id}</a>
            <ul class="pagination">
                <li class="last"><a href="?invalid=param">Last</a></li>
                <li><a href="?page=text">Invalid</a></li>
                <li><a href="#" data-page="invalid">Invalid</a></li>
            </ul>
        </body>
    </html>
    """

    result_links, result_last_page = CatalogParser().parse(html, base_url=base_url)

    assert result_links == [f"{base_url}/course/{course_id}"]
    assert result_last_page is None


def test_catalog_parser_no_pagination_element():
    course_id = fake.random_int(min=100, max=999)
    base_url = fake.url().rstrip("/")

    html = f"""
    <html>
        <body>
            <a href="/course/{course_id}">Course {course_id}</a>
            <div class="other-content">No pagination here</div>
        </body>
    </html>
    """

    result_links, result_last_page = CatalogParser().parse(html, base_url=base_url)

    assert result_links == [f"{base_url}/course/{course_id}"]
    assert result_last_page is None


def test_catalog_parser_multiple_pagination_strategies():
    course_id = fake.random_int(min=100, max=999)
    base_url = fake.url().rstrip("/")
    query_page = fake.random_int(min=10, max=20)
    data_page = fake.random_int(min=1, max=5)
    numeric_pages = [fake.random_int(min=1, max=3) for _ in range(3)]
    expected_max = max(query_page, data_page + 1, max(numeric_pages))

    page_links = "".join([f'<li><a href="?page={p}">{p}</a></li>' for p in numeric_pages])

    html = f'''
    <html>
        <body>
            <a href="/course/{course_id}">Course {course_id}</a>
            <ul class="pagination">
                <li class="last"><a href="?page={query_page}">Last</a></li>
                <li><a href="#" data-page="{data_page}">Data Page</a></li>
                {page_links}
            </ul>
        </body>
    </html>
    '''

    result_links, result_last_page = CatalogParser().parse(html, base_url=base_url)

    assert result_links == [f"{base_url}/course/{course_id}"]
    assert result_last_page == expected_max


def test_catalog_parser_with_malformed_html():
    base_url = fake.url().rstrip("/")

    html = """
    <html>
        <body>
            <a href="/course/123">Course 123</a>
            <ul class="pagination">
                <li class="last"><a href="?page=10">Last</a></li>
            </ul>
            <div>
                <table>
                    <tr>
                        <td>Broken content</td>
                    </tr>
                </table>
            </div>
        </body>
    </html>
    """

    result_links, result_last_page = CatalogParser().parse(html, base_url=base_url)

    assert result_links == [f"{base_url}/course/123"]
    assert result_last_page == 10


def test_course_link_parser_with_malformed_links():
    html = """
    <html>
        <body>
            <a href="/course/123">Valid</a>
            <a href="/course/">Invalid empty</a>
            <a href="course/456">Invalid relative</a>
            <a>Missing href</a>
            <a href="/other/page">Wrong pattern</a>
        </body>
    </html>
    """
    base_url = fake.url().rstrip("/")

    result = CourseLinkParser().parse(html, base_url=base_url)

    assert result == [f"{base_url}/course/123"]


def test_course_detail_parser_with_malformed_html():
    url = fake.url()

    html = """
    <html>
        <body>
            <div class="page-header">
                <h1>Course Title</h1>
            </div>
            <table class="table table-condensed table-bordered">
                <tbody>
                    <tr>
                        <td>Missing th</td>
                        <td>Some data</td>
                    </tr>
                    <tr>
                        <th>Valid header</th>
                        <!-- Missing td -->
                    </tr>
                </tbody>
            </table>
        </body>
    </html>
    """

    result = CourseDetailParser().parse(html, url=url)

    assert result.url == url
    assert result.title == "Course Title"
    assert result.id is None
    assert result.credits is None


def test_specialty_parser_with_malformed_table():
    html = f"""
    <html>
        <body>
            <div id="course--spec">
                <table>
                    <tbody>
                        <tr>
                            <td>{fake.job()}</td>
                            <!-- Missing second td -->
                        </tr>
                        <tr>
                            <!-- Missing both tds -->
                        </tr>
                        <tr>
                            <td>{fake.job()}</td>
                            <td>{fake.word()}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </body>
    </html>
    """

    result = SpecialtyParser().parse(html)

    assert len(result) == 1


def test_students_parser_with_malformed_table():
    html = f"""
    <table>
        <caption>Перелік студентів</caption>
        <tbody>
            <tr>
                <!-- Missing tds -->
            </tr>
            <tr>
                <td>1</td>
                <!-- Missing other tds -->
            </tr>
            <tr>
                <td>2</td>
                <td>{fake.name()}</td>
                <td>Computer Science</td>
            </tr>
        </tbody>
    </table>
    """

    result = StudentsParser().parse(html)

    assert len(result) == 2
    assert result[0].index == "1"
    assert result[0].name == ""
    assert result[1].index == "2"
    assert result[1].name is not None
