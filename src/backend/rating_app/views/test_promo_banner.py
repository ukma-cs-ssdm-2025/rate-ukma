from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse

import pytest

from rating_app.models import PromoBanner

PROMO_BANNER_URL = "/api/v1/promo-banner/"


@pytest.fixture
def banner_payload():
    return {
        "title": "KMA Events",
        "description": "Єдиний потік подій",
        "href": "https://kmaevents.com/",
        "cta_label": "Відкрити",
    }


@pytest.mark.integration
@pytest.mark.django_db
def test_returns_null_when_no_active_banner(api_client, banner_payload):
    PromoBanner.objects.create(is_active=False, **banner_payload)

    response = api_client.get(reverse("promo-banner-list"))

    assert response.status_code == 200
    assert response.json()["banner"] is None


@pytest.mark.integration
@pytest.mark.django_db
def test_returns_active_banner(api_client, banner_payload):
    banner = PromoBanner.objects.create(is_active=True, **banner_payload)

    response = api_client.get(reverse("promo-banner-list"))

    assert response.status_code == 200
    data = response.json()["banner"]
    assert data["id"] == str(banner.id)
    assert data["title"] == "KMA Events"
    assert data["href"] == "https://kmaevents.com/"
    assert data["cta_label"] == "Відкрити"
    # No file uploaded, so there is no URL to serve.
    assert data["logo_url"] is None


@pytest.mark.integration
@pytest.mark.django_db
def test_logo_alt_falls_back_to_title(api_client, banner_payload):
    PromoBanner.objects.create(is_active=True, logo_alt="", **banner_payload)

    response = api_client.get(reverse("promo-banner-list"))

    assert response.json()["banner"]["logo_alt"] == "KMA Events"


@pytest.mark.integration
@pytest.mark.django_db
def test_activating_a_banner_deactivates_the_previous_one(api_client, banner_payload):
    older = PromoBanner.objects.create(is_active=True, **{**banner_payload, "title": "Older"})
    newer = PromoBanner.objects.create(is_active=True, **{**banner_payload, "title": "Newer"})

    older.refresh_from_db()
    assert older.is_active is False
    assert PromoBanner.objects.filter(is_active=True).count() == 1

    response = api_client.get(reverse("promo-banner-list"))
    assert response.json()["banner"]["id"] == str(newer.id)


@pytest.mark.integration
@pytest.mark.django_db
def test_saving_an_inactive_banner_leaves_the_active_one_alone(banner_payload):
    active = PromoBanner.objects.create(is_active=True, **{**banner_payload, "title": "Live"})

    PromoBanner.objects.create(is_active=False, **{**banner_payload, "title": "Draft"})

    active.refresh_from_db()
    assert active.is_active is True


@pytest.mark.integration
@pytest.mark.django_db
def test_editing_the_active_banner_keeps_it_active(banner_payload):
    active = PromoBanner.objects.create(is_active=True, **banner_payload)

    active.title = "Renamed"
    active.save()

    active.refresh_from_db()
    assert active.is_active is True
    assert PromoBanner.objects.filter(is_active=True).count() == 1


@pytest.mark.integration
@pytest.mark.django_db
def test_endpoint_is_public(api_client, banner_payload):
    PromoBanner.objects.create(is_active=True, **banner_payload)

    response = api_client.get(reverse("promo-banner-list"))

    assert response.status_code == 200


@pytest.mark.integration
@pytest.mark.django_db
def test_logo_url_is_absolute(api_client, banner_payload, settings, tmp_path):
    # The SPA runs on a different origin in dev, so a root-relative "/media/..."
    # would resolve against the frontend and 404 instead of loading the image.
    settings.MEDIA_ROOT = tmp_path
    PromoBanner.objects.create(
        is_active=True,
        logo=SimpleUploadedFile("logo.svg", b"<svg xmlns='http://www.w3.org/2000/svg'/>"),
        **banner_payload,
    )

    response = api_client.get(reverse("promo-banner-list"))

    logo_url = response.json()["banner"]["logo_url"]
    assert logo_url.startswith("http://")
    assert "/media/promo/" in logo_url
