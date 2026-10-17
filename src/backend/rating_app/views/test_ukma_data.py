import json
import socket
import threading
import time
from datetime import UTC, datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlsplit

from django.urls import reverse

import pytest

API_KEY = "test-ukma-data-key"
DATA_UPDATED_AT = "2030-09-01T10:00:00.000Z"

TERM = {"id": "t-1", "code": "2030-FALL", "academicYear": 2030, "season": "FALL", "changeNo": 1}
FACULTY = {
    "id": "f-1",
    "name": "Факультет тестових наук",
    "sazFilterId": "7",
    "changeNo": 2,
    "removedAt": None,
}
DEPARTMENT = {
    "id": "d-1",
    "name": "Кафедра прикладів",
    "sazFilterId": None,
    "facultyId": "f-1",
    "changeNo": 3,
    "removedAt": None,
}
PROGRAMME = {
    "id": "p-1",
    "name": "Тестова програма",
    "level": "bachelor",
    "sazFilterId": "12",
    "changeNo": 4,
    "removedAt": None,
}
OFFERING = {
    "id": "o-1",
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
REVIEW_CASE = {
    "id": "rc-1",
    "kind": "course_match",
    "subjectId": "o-1",
    "candidates": ["c-1", "c-2"],
    "safeAnswer": None,
    "status": "open",
    "runId": "r-1",
    "decisionId": None,
    "openedAt": "2030-09-01T08:00:00.000Z",
    "changeNo": 6,
}
KEY = {
    "id": "k-1",
    "scopes": ["catalog:read", "review:decide"],
    "expiresAt": "2031-01-01T00:00:00.000Z",
}


def _page(*items, has_more=False):
    return {
        "items": list(items),
        "cursor": items[-1]["changeNo"] if items else 0,
        "hasMore": has_more,
        "dataUpdatedAt": DATA_UPDATED_AT,
    }


def _parse(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


class FakeUkmaData:
    """UKMA Data's read API on a real local socket: the one external system
    these endpoints talk to, so the proxy's own HTTP code runs unpatched."""

    def __init__(self):
        self.replies: dict[str, tuple[int, object]] = {}
        self.received: list[dict] = []
        self.delay_seconds = 0.0
        self._server = ThreadingHTTPServer(("127.0.0.1", 0), self._handler())
        self.url = f"http://127.0.0.1:{self._server.server_port}"

    def reply(self, path: str, body: object, status: int = 200) -> None:
        self.replies[path] = (status, body)

    def _handler(self):
        fake = self

        class Handler(BaseHTTPRequestHandler):
            def do_GET(self):  # noqa: N802 - the stdlib's naming
                url = urlsplit(self.path)
                fake.received.append(
                    {
                        "path": url.path,
                        "query": parse_qs(url.query),
                        "authorization": self.headers.get("Authorization"),
                    }
                )
                time.sleep(fake.delay_seconds)
                status, body = fake.replies.get(url.path, (404, {"_tag": "NotFound"}))
                payload = body if isinstance(body, bytes) else json.dumps(body).encode()
                try:
                    self.send_response(status)
                    self.send_header("Content-Type", "application/json")
                    self.end_headers()
                    self.wfile.write(payload)
                except (BrokenPipeError, ConnectionResetError):
                    pass  # the client gave up first: the timeout test

            def log_message(self, format, *args):
                pass

        return Handler

    def __enter__(self):
        # A short poll keeps shutdown() from adding half a second to every test
        threading.Thread(
            target=self._server.serve_forever, kwargs={"poll_interval": 0.01}, daemon=True
        ).start()
        return self

    def __exit__(self, *exc):
        self._server.shutdown()
        self._server.server_close()


@pytest.fixture(autouse=True)
def ukma_data(settings):
    with FakeUkmaData() as fake:
        settings.UKMA_DATA_URL = fake.url
        settings.UKMA_DATA_API_KEY = API_KEY
        settings.UKMA_DATA_TIMEOUT_SECONDS = 2
        yield fake


@pytest.fixture
def superuser_client(token_client):
    token_client.user.is_superuser = True
    token_client.user.save()
    return token_client


@pytest.fixture
def offerings_url():
    return reverse("ukma-data-offerings")


@pytest.mark.django_db
@pytest.mark.integration
def test_offerings_returns_snake_case_page_when_superuser(
    superuser_client, ukma_data, offerings_url
):
    ukma_data.reply("/v1/offerings", _page(OFFERING, has_more=True))

    response = superuser_client.get(offerings_url)

    assert response.status_code == 200
    body = response.json()
    assert body["cursor"] == 5
    assert body["has_more"] is True
    assert _parse(body["data_updated_at"]) == _parse(DATA_UPDATED_AT)
    offering = body["items"][0]
    assert offering["saz_code"] == "TST-0001"
    assert offering["enrolled_active"] == 21
    assert offering["terms"][0]["control"] == "exam"
    assert offering["programmes"] == [{"programme_id": "p-1", "kind": "elective"}]


@pytest.mark.django_db
@pytest.mark.integration
@pytest.mark.parametrize(
    ("route", "upstream_path", "item", "field", "value"),
    [
        ("ukma-data-terms", "/v1/terms", TERM, "season", "FALL"),
        ("ukma-data-faculties", "/v1/faculties", FACULTY, "saz_filter_id", "7"),
        ("ukma-data-departments", "/v1/departments", DEPARTMENT, "faculty_id", "f-1"),
        ("ukma-data-programmes", "/v1/programmes", PROGRAMME, "level", "bachelor"),
        ("ukma-data-review-cases", "/v1/review-cases", REVIEW_CASE, "candidates", ["c-1", "c-2"]),
    ],
)
def test_list_returns_its_upstream_list(
    superuser_client, ukma_data, route, upstream_path, item, field, value
):
    ukma_data.reply(upstream_path, _page(item))

    response = superuser_client.get(reverse(route))

    assert response.status_code == 200
    assert response.json()["items"][0][field] == value
    assert [r["path"] for r in ukma_data.received] == [upstream_path]


@pytest.mark.django_db
@pytest.mark.integration
def test_offerings_returns_403_when_not_superuser(token_client, ukma_data, offerings_url):
    response = token_client.get(offerings_url)

    assert response.status_code == 403
    assert ukma_data.received == []


def test_offerings_returns_403_when_anonymous(api_client, ukma_data, offerings_url):
    response = api_client.get(offerings_url)

    assert response.status_code == 403
    assert ukma_data.received == []


@pytest.mark.django_db
@pytest.mark.integration
def test_offerings_forwards_key_and_page_params(superuser_client, ukma_data, offerings_url):
    ukma_data.reply("/v1/offerings", _page())

    superuser_client.get(offerings_url, {"after": 41, "limit": 50})

    assert ukma_data.received == [
        {
            "path": "/v1/offerings",
            "query": {"after": ["41"], "limit": ["50"]},
            "authorization": f"Bearer {API_KEY}",
        }
    ]


@pytest.mark.django_db
@pytest.mark.integration
def test_offerings_sends_no_page_params_when_none_given(superuser_client, ukma_data, offerings_url):
    ukma_data.reply("/v1/offerings", _page())

    superuser_client.get(offerings_url)

    assert ukma_data.received[0]["query"] == {}


@pytest.mark.django_db
@pytest.mark.integration
def test_offerings_caps_limit_at_upstream_max(superuser_client, ukma_data, offerings_url):
    ukma_data.reply("/v1/offerings", _page())

    response = superuser_client.get(offerings_url, {"limit": 5000})

    assert response.status_code == 200
    assert ukma_data.received[0]["query"]["limit"] == ["1000"]


@pytest.mark.django_db
@pytest.mark.integration
@pytest.mark.parametrize(("param", "value"), [("limit", 0), ("after", -1), ("limit", "many")])
def test_offerings_returns_400_when_page_param_invalid(
    superuser_client, ukma_data, offerings_url, param, value
):
    response = superuser_client.get(offerings_url, {param: value})

    assert response.status_code == 400
    assert ukma_data.received == []


@pytest.mark.django_db
@pytest.mark.integration
@pytest.mark.parametrize("setting", ["UKMA_DATA_URL", "UKMA_DATA_API_KEY"])
def test_offerings_returns_503_when_not_configured(
    superuser_client, ukma_data, settings, offerings_url, setting
):
    setattr(settings, setting, "")

    response = superuser_client.get(offerings_url)

    assert response.status_code == 503
    assert "UKMA_DATA_URL and UKMA_DATA_API_KEY" in response.json()["detail"]
    assert ukma_data.received == []


@pytest.mark.django_db
@pytest.mark.integration
@pytest.mark.parametrize("upstream_status", [500, 503, 401])
def test_offerings_returns_502_when_upstream_fails(
    superuser_client, ukma_data, offerings_url, upstream_status
):
    ukma_data.reply("/v1/offerings", {"_tag": "Error"}, status=upstream_status)

    response = superuser_client.get(offerings_url)

    assert response.status_code == 502
    assert response.json()["detail"] == f"UKMA Data answered {upstream_status}."


@pytest.mark.django_db
@pytest.mark.integration
def test_offerings_returns_502_when_upstream_times_out(
    superuser_client, ukma_data, settings, offerings_url
):
    ukma_data.reply("/v1/offerings", _page())
    ukma_data.delay_seconds = 0.5
    settings.UKMA_DATA_TIMEOUT_SECONDS = 0.1

    response = superuser_client.get(offerings_url)

    assert response.status_code == 502
    assert response.json()["detail"] == "UKMA Data did not answer in time."


@pytest.mark.django_db
@pytest.mark.integration
def test_offerings_returns_502_when_upstream_down(superuser_client, settings, offerings_url):
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        closed_port = probe.getsockname()[1]
    settings.UKMA_DATA_URL = f"http://127.0.0.1:{closed_port}"

    response = superuser_client.get(offerings_url)

    assert response.status_code == 502
    assert response.json()["detail"] == "UKMA Data is unreachable."


@pytest.mark.django_db
@pytest.mark.integration
@pytest.mark.parametrize(
    "body",
    [{"items": [{"id": "o-1"}], "cursor": 1, "hasMore": False, "dataUpdatedAt": None}, b"<html>"],
)
def test_offerings_returns_502_when_upstream_breaks_contract(
    superuser_client, ukma_data, offerings_url, body
):
    ukma_data.reply("/v1/offerings", body)

    response = superuser_client.get(offerings_url)

    assert response.status_code == 502
    assert response.json()["detail"] == "UKMA Data sent an unexpected response."


@pytest.mark.django_db
@pytest.mark.integration
def test_status_returns_key_and_data_updated_at(superuser_client, ukma_data):
    ukma_data.reply("/v1/key", KEY)
    ukma_data.reply("/v1/terms", _page(TERM))

    response = superuser_client.get(reverse("ukma-data-status"))

    assert response.status_code == 200
    body = response.json()
    assert body["key_id"] == "k-1"
    assert body["scopes"] == ["catalog:read", "review:decide"]
    assert _parse(body["key_expires_at"]) == datetime(2031, 1, 1, tzinfo=UTC)
    assert _parse(body["data_updated_at"]) == _parse(DATA_UPDATED_AT)
    assert [(r["path"], r["query"]) for r in ukma_data.received] == [
        ("/v1/key", {}),
        ("/v1/terms", {"limit": ["1"]}),
    ]


@pytest.mark.django_db
@pytest.mark.integration
def test_status_returns_502_when_key_rejected(superuser_client, ukma_data):
    ukma_data.reply("/v1/key", {"_tag": "Unauthorized"}, status=401)

    response = superuser_client.get(reverse("ukma-data-status"))

    assert response.status_code == 502
    assert response.json()["detail"] == "UKMA Data answered 401."
