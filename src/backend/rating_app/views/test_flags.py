import pytest
from waffle.models import Flag

FLAGS_URL = "/api/v1/flags/"


@pytest.mark.django_db
@pytest.mark.integration
def test_flags_accessible_anonymously(api_client, settings):
    settings.PUBLIC_FEATURE_FLAGS = ["fe_example"]

    response = api_client.get(FLAGS_URL)

    assert response.status_code == 200
    assert "fe_example" in response.json()["flags"]


@pytest.mark.django_db
@pytest.mark.integration
def test_flags_reflect_active_state(api_client, settings):
    settings.PUBLIC_FEATURE_FLAGS = ["fe_example"]
    Flag.objects.create(name="fe_example", everyone=True)

    response = api_client.get(FLAGS_URL)

    assert response.status_code == 200
    assert response.json()["flags"]["fe_example"] is True


@pytest.mark.django_db
@pytest.mark.integration
def test_flags_default_to_false_when_not_created(api_client, settings):
    settings.PUBLIC_FEATURE_FLAGS = ["fe_example"]

    response = api_client.get(FLAGS_URL)

    assert response.status_code == 200
    assert response.json()["flags"]["fe_example"] is False


@pytest.mark.django_db
@pytest.mark.integration
def test_flags_response_is_not_cacheable(api_client, settings):
    settings.PUBLIC_FEATURE_FLAGS = ["fe_example"]

    response = api_client.get(FLAGS_URL)

    assert response.status_code == 200
    assert "no-store" in response.headers["Cache-Control"]


@pytest.mark.django_db
@pytest.mark.integration
def test_non_allowlisted_flag_is_never_exposed(api_client, settings):
    settings.PUBLIC_FEATURE_FLAGS = ["fe_example"]
    Flag.objects.create(name="fe_secret_internal", everyone=True)

    response = api_client.get(FLAGS_URL)

    assert response.status_code == 200
    assert "fe_secret_internal" not in response.json()["flags"]
