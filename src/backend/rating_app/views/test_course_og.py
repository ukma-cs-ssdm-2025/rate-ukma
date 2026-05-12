import pytest

TELEGRAM_UA = "TelegramBot (like TwitterBot)"
BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0"


@pytest.mark.django_db
@pytest.mark.integration
def test_bot_request_returns_og_html_with_course_title(api_client, course_factory):
    course = course_factory.create()
    url = f"/courses/{course.id}/"

    response = api_client.get(url, HTTP_USER_AGENT=TELEGRAM_UA)

    assert response.status_code == 200
    assert response["Content-Type"] == "text/html; charset=utf-8"
    content = response.content.decode()
    assert f"{course.title} | Rate UKMA" in content
    assert 'property="og:title"' in content


@pytest.mark.django_db
@pytest.mark.integration
def test_bot_request_for_nonexistent_course_returns_404(api_client):
    url = "/courses/00000000-0000-0000-0000-000000000000/"

    response = api_client.get(url, HTTP_USER_AGENT=TELEGRAM_UA)

    assert response.status_code == 404
