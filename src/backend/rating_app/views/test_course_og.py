import pytest

_MINIMAL_INDEX = "<html><head></head><body><div id='app'></div></body></html>"


@pytest.mark.django_db
@pytest.mark.integration
def test_course_page_returns_og_tags_with_course_title(
    api_client, course_factory, tmp_path, settings
):
    settings.STATIC_ROOT = tmp_path
    (tmp_path / "index.html").write_text(_MINIMAL_INDEX)
    course = course_factory.create()

    response = api_client.get(f"/courses/{course.id}/")

    assert response.status_code == 200
    assert response["Content-Type"] == "text/html; charset=utf-8"
    content = response.content.decode()
    assert f"{course.title} | Rate UKMA" in content
    assert 'property="og:title"' in content


@pytest.mark.django_db
@pytest.mark.integration
def test_course_page_returns_404_for_nonexistent_course(api_client, tmp_path, settings):
    settings.STATIC_ROOT = tmp_path
    (tmp_path / "index.html").write_text(_MINIMAL_INDEX)

    response = api_client.get("/courses/00000000-0000-0000-0000-000000000000/")

    assert response.status_code == 404
