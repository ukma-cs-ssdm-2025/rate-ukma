import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit

from django.urls import reverse

import pytest

from rating_app.models import UkmaDataDecision, UkmaDataDecisionOutcome
from rating_app.services.ukma_data_service import UkmaDataService

API_KEY = "test-ukma-data-key"
KEY = {
    "id": "k-2",
    "scopes": ["catalog:read", "review:read", "review:decide"],
    "expiresAt": "2031-01-01T00:00:00.000Z",
}
READ_ONLY_KEY = {
    "id": "k-2",
    "scopes": ["catalog:read", "review:read"],
    "expiresAt": "2031-01-01T00:00:00.000Z",
}


class FakeUkmaData:
    """UKMA Data's decision API on a real local socket, like `test_ukma_data.py`."""

    def __init__(self):
        self.replies: dict[str, tuple[int, object]] = {}
        self.received: list[dict] = []
        self.down_paths: set[str] = set()
        self._server = ThreadingHTTPServer(("127.0.0.1", 0), self._handler())
        self.url = f"http://127.0.0.1:{self._server.server_port}"

    def reply(self, path: str, body: object = b"", status: int = 204) -> None:
        self.replies[path] = (status, body)

    def _request(self, method: str, handler: BaseHTTPRequestHandler) -> None:
        url = urlsplit(handler.path)
        length = int(handler.headers.get("Content-Length") or 0)
        raw = handler.rfile.read(length) if length else b""
        self.received.append(
            {
                "method": method,
                "path": url.path,
                "authorization": handler.headers.get("Authorization"),
                "body": json.loads(raw) if raw else None,
            }
        )
        if url.path in self.down_paths:
            handler.close_connection = True
            return
        status, body = self.replies.get(url.path, (404, {"_tag": "NotFound"}))
        payload = body if isinstance(body, bytes) else json.dumps(body).encode()
        handler.send_response(status)
        handler.send_header("Content-Type", "application/json")
        handler.end_headers()
        try:
            handler.wfile.write(payload)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def _handler(self):
        fake = self

        class Handler(BaseHTTPRequestHandler):
            def do_GET(self):  # noqa: N802 - the stdlib's naming
                fake._request("GET", self)

            def do_POST(self):  # noqa: N802 - the stdlib's naming
                fake._request("POST", self)

            def log_message(self, format, *args):
                pass

        return Handler

    def __enter__(self):
        threading.Thread(
            target=self._server.serve_forever, kwargs={"poll_interval": 0.01}, daemon=True
        ).start()
        return self

    def __exit__(self, *exc):
        self._server.shutdown()
        self._server.server_close()


@pytest.fixture
def ukma_data(settings):
    with FakeUkmaData() as fake:
        settings.UKMA_DATA_URL = fake.url
        settings.UKMA_DATA_API_KEY = API_KEY
        settings.UKMA_DATA_TIMEOUT_SECONDS = 2
        fake.reply("/v1/key", KEY, status=200)
        yield fake


@pytest.fixture
def superuser_client(token_client):
    token_client.user.is_superuser = True
    token_client.user.save()
    return token_client


@pytest.fixture
def decide_url():
    return reverse("ukma-data-review-case-decide", kwargs={"case_id": "rc-101"})


@pytest.fixture
def merge_url():
    return reverse("ukma-data-course-merge", kwargs={"course_id": "c-101"})


@pytest.fixture
def unmerge_url():
    return reverse("ukma-data-course-unmerge", kwargs={"course_id": "c-101"})


def _posts(fake: FakeUkmaData) -> list[dict]:
    return [item for item in fake.received if item["method"] == "POST"]


@pytest.mark.django_db
@pytest.mark.integration
@pytest.mark.parametrize(
    "url_name",
    ["ukma-data-review-case-decide", "ukma-data-course-merge", "ukma-data-course-unmerge"],
)
def test_decision_returns_403_when_anonymous(api_client, ukma_data, url_name):
    kwargs = {"case_id": "rc-101"} if "review" in url_name else {"course_id": "c-101"}

    response = api_client.post(reverse(url_name, kwargs=kwargs))

    assert response.status_code == 403
    assert ukma_data.received == []


@pytest.mark.django_db
@pytest.mark.integration
@pytest.mark.parametrize(
    "url_name",
    ["ukma-data-review-case-decide", "ukma-data-course-merge", "ukma-data-course-unmerge"],
)
def test_decision_returns_403_when_regular_user(token_client, ukma_data, url_name):
    kwargs = {"case_id": "rc-101"} if "review" in url_name else {"course_id": "c-101"}

    response = token_client.post(reverse(url_name, kwargs=kwargs))

    assert response.status_code == 403
    assert ukma_data.received == []


@pytest.mark.django_db
@pytest.mark.integration
@pytest.mark.parametrize(
    "url_name",
    ["ukma-data-review-case-decide", "ukma-data-course-merge", "ukma-data-course-unmerge"],
)
def test_decision_returns_403_when_staff_not_superuser(token_client, ukma_data, url_name):
    kwargs = {"case_id": "rc-101"} if "review" in url_name else {"course_id": "c-101"}
    token_client.user.is_staff = True
    token_client.user.save()

    response = token_client.post(reverse(url_name, kwargs=kwargs))

    assert response.status_code == 403
    assert ukma_data.received == []


@pytest.mark.django_db
@pytest.mark.integration
@pytest.mark.parametrize(
    "url_name",
    ["ukma-data-review-case-decide", "ukma-data-course-merge", "ukma-data-course-unmerge"],
)
def test_decision_returns_503_when_the_key_is_not_configured(
    superuser_client, ukma_data, settings, url_name
):
    kwargs = {"case_id": "rc-101"} if "review" in url_name else {"course_id": "c-101"}
    body = {"into": "c-102"} if url_name == "ukma-data-course-merge" else None
    settings.UKMA_DATA_API_KEY = ""

    response = superuser_client.post(reverse(url_name, kwargs=kwargs), body, format="json")

    assert response.status_code == 503
    assert response.json()["code"] == "ukma_data_not_configured"
    assert ukma_data.received == []
    assert UkmaDataDecision.objects.count() == 0


@pytest.mark.django_db
@pytest.mark.integration
@pytest.mark.parametrize(
    "url_name",
    ["ukma-data-review-case-decide", "ukma-data-course-merge", "ukma-data-course-unmerge"],
)
def test_decision_returns_403_when_the_key_lacks_the_scope(superuser_client, ukma_data, url_name):
    kwargs = {"case_id": "rc-101"} if "review" in url_name else {"course_id": "c-101"}
    body = {"into": "c-102"} if url_name == "ukma-data-course-merge" else None
    ukma_data.reply("/v1/key", READ_ONLY_KEY, status=200)

    response = superuser_client.post(reverse(url_name, kwargs=kwargs), body, format="json")

    assert response.status_code == 403
    assert response.json()["code"] == "ukma_data_forbidden"
    assert response.json()["detail"] == "Тут лише перегляд: рішення змінюють спільні дані САЗ"
    assert [item["path"] for item in ukma_data.received] == ["/v1/key"]
    assert ukma_data.received[0]["authorization"] == f"Bearer {API_KEY}"
    assert UkmaDataDecision.objects.count() == 0


@pytest.mark.django_db
@pytest.mark.integration
def test_decide_closes_the_case_and_writes_the_decision(superuser_client, ukma_data, decide_url):
    ukma_data.reply("/v1/review-cases/rc-101/decide")

    response = superuser_client.post(decide_url)

    assert response.status_code == 200
    body = response.json()
    assert body["action"] == "decide_case"
    assert body["outcome"] == "done"
    assert body["detail"] == "Справу закрито: це та сама людина."
    post = _posts(ukma_data)[0]
    assert post["path"] == "/v1/review-cases/rc-101/decide"
    assert post["body"] == {"decision": "same_person"}
    assert post["authorization"] == f"Bearer {API_KEY}"
    decision = UkmaDataDecision.objects.get()
    assert decision.pk == body["decision_id"]
    assert decision.user == superuser_client.user
    assert decision.action == "decide_case"
    assert decision.target_id == "rc-101"
    assert decision.related_id == ""
    assert decision.outcome == UkmaDataDecisionOutcome.DONE
    assert decision.error == ""


@pytest.mark.django_db
@pytest.mark.integration
def test_merge_merges_the_course_and_records_the_target(superuser_client, ukma_data, merge_url):
    ukma_data.reply("/v1/courses/c-101/merge")

    response = superuser_client.post(merge_url, {"into": "c-102"}, format="json")

    assert response.status_code == 200
    assert response.json()["detail"] == "Курс об'єднано."
    assert _posts(ukma_data)[0]["body"] == {"into": "c-102"}
    decision = UkmaDataDecision.objects.get()
    assert decision.action == "merge_course"
    assert decision.target_id == "c-101"
    assert decision.related_id == "c-102"
    assert decision.outcome == UkmaDataDecisionOutcome.DONE


@pytest.mark.django_db
@pytest.mark.integration
def test_merge_returns_400_without_into(superuser_client, ukma_data, merge_url):
    response = superuser_client.post(merge_url, {}, format="json")

    assert response.status_code == 400
    assert list(response.json()["fields"]) == ["into"]
    assert _posts(ukma_data) == []


@pytest.mark.django_db
@pytest.mark.integration
def test_unmerge_undoes_the_merge_and_writes_the_decision(superuser_client, ukma_data, unmerge_url):
    ukma_data.reply("/v1/courses/c-101/unmerge")

    response = superuser_client.post(unmerge_url)

    assert response.status_code == 200
    assert response.json()["detail"] == "Курс роз'єднано."
    post = _posts(ukma_data)[0]
    assert post["path"] == "/v1/courses/c-101/unmerge"
    assert post["body"] is None
    decision = UkmaDataDecision.objects.get()
    assert decision.action == "unmerge_course"
    assert decision.target_id == "c-101"
    assert decision.related_id == ""
    assert decision.outcome == UkmaDataDecisionOutcome.DONE


@pytest.mark.django_db
@pytest.mark.integration
@pytest.mark.parametrize(
    ("url_name", "kwargs", "path"),
    [
        ("ukma-data-review-case-decide", {"case_id": "rc-101"}, "/v1/review-cases/rc-101/decide"),
        ("ukma-data-course-merge", {"course_id": "c-101"}, "/v1/courses/c-101/merge"),
        ("ukma-data-course-unmerge", {"course_id": "c-101"}, "/v1/courses/c-101/unmerge"),
    ],
)
def test_decision_returns_404_when_ukma_data_does_not_know_it(
    superuser_client, ukma_data, url_name, kwargs, path
):
    ukma_data.reply(path, {"_tag": "NotFound"}, status=404)

    response = superuser_client.post(
        reverse(url_name, kwargs=kwargs),
        {"into": "c-102"} if url_name == "ukma-data-course-merge" else None,
        format="json",
    )

    assert response.status_code == 404
    assert response.json() == {
        "detail": "UKMA Data не знає такої справи або курсу",
        "status": 404,
        "code": "ukma_data_not_found",
    }
    decision = UkmaDataDecision.objects.get()
    assert decision.outcome == UkmaDataDecisionOutcome.REFUSED
    assert decision.error == "not_found"


@pytest.mark.django_db
@pytest.mark.integration
@pytest.mark.parametrize(
    ("reason", "detail"),
    [
        ("same_course", "Не можна об'єднати курс сам із собою."),
        ("course_merged", "Цей курс уже об'єднано з іншим."),
        ("target_merged", "Курс, з яким об'єднують, уже об'єднано з іншим."),
        ("level_mismatch", "Курси різного рівня: об'єднати можна лише однакові."),
        ("not_merged", "Цей курс не об'єднано, тож роз'єднувати нічого."),
    ],
)
def test_merge_returns_409_with_the_reason_text(
    superuser_client, ukma_data, merge_url, reason, detail
):
    ukma_data.reply(
        "/v1/courses/c-101/merge",
        {"_tag": "CourseDecisionRefused", "reason": reason},
        status=409,
    )

    response = superuser_client.post(merge_url, {"into": "c-102"}, format="json")

    assert response.status_code == 409
    assert response.json()["detail"] == detail
    assert response.json()["code"] == "ukma_data_refused"
    decision = UkmaDataDecision.objects.get()
    assert decision.outcome == UkmaDataDecisionOutcome.REFUSED
    assert decision.error == reason


@pytest.mark.django_db
@pytest.mark.integration
@pytest.mark.parametrize(
    ("reason", "detail"), [("not_student_match", "Це не справа про студента.")]
)
def test_decide_returns_409_with_the_case_reason(
    superuser_client, ukma_data, decide_url, reason, detail
):
    ukma_data.reply(
        "/v1/review-cases/rc-101/decide",
        {"_tag": "ReviewCaseRefused", "reason": reason},
        status=409,
    )

    response = superuser_client.post(decide_url)

    assert response.status_code == 409
    assert response.json()["detail"] == detail
    assert UkmaDataDecision.objects.get().error == reason


@pytest.mark.django_db
@pytest.mark.integration
def test_unmerge_returns_409_when_nothing_is_merged(superuser_client, ukma_data, unmerge_url):
    ukma_data.reply(
        "/v1/courses/c-101/unmerge",
        {"_tag": "CourseDecisionRefused", "reason": "not_merged"},
        status=409,
    )

    response = superuser_client.post(unmerge_url)

    assert response.status_code == 409
    assert response.json()["detail"] == "Цей курс не об'єднано, тож роз'єднувати нічого."
    decision = UkmaDataDecision.objects.get()
    assert decision.action == "unmerge_course"
    assert decision.error == "not_merged"


@pytest.mark.django_db
@pytest.mark.integration
def test_merge_returns_409_for_a_truthy_but_unknown_reason(superuser_client, ukma_data, merge_url):
    ukma_data.reply("/v1/courses/c-101/merge", {"reason": 7}, status=409)

    response = superuser_client.post(merge_url, {"into": "c-102"}, format="json")

    assert response.status_code == 409
    assert response.json()["detail"] == "UKMA Data відмовила в цьому рішенні"
    assert UkmaDataDecision.objects.get().error == "refused"


@pytest.mark.django_db
@pytest.mark.integration
@pytest.mark.parametrize(
    ("url_name", "kwargs", "path"),
    [
        ("ukma-data-review-case-decide", {"case_id": "rc-101"}, "/v1/review-cases/rc-101/decide"),
        ("ukma-data-course-merge", {"course_id": "c-101"}, "/v1/courses/c-101/merge"),
        ("ukma-data-course-unmerge", {"course_id": "c-101"}, "/v1/courses/c-101/unmerge"),
    ],
)
def test_decision_returns_502_and_records_a_failure_when_ukma_data_is_down(
    superuser_client, ukma_data, url_name, kwargs, path
):
    ukma_data.down_paths.add(path)

    response = superuser_client.post(
        reverse(url_name, kwargs=kwargs),
        {"into": "c-102"} if url_name == "ukma-data-course-merge" else None,
        format="json",
    )

    assert response.status_code == 502
    assert response.json()["detail"] == "UKMA Data is unreachable."
    decision = UkmaDataDecision.objects.get()
    assert decision.outcome == UkmaDataDecisionOutcome.FAILED
    assert decision.error == "UKMA Data is unreachable."


@pytest.mark.django_db
@pytest.mark.integration
def test_decision_returns_502_when_ukma_data_is_down_before_the_key_is_read(
    superuser_client, ukma_data, decide_url
):
    ukma_data.down_paths.add("/v1/key")

    response = superuser_client.post(decide_url, format="json")

    assert response.status_code == 502
    assert response.json()["detail"] == "UKMA Data is unreachable."
    assert _posts(ukma_data) == []


@pytest.mark.django_db
@pytest.mark.integration
@pytest.mark.parametrize("course_id", ["c.101", "c%3F1", "c" * 65])
def test_decision_returns_404_for_an_id_unfit_for_the_parser_path(
    superuser_client, ukma_data, merge_url, course_id
):
    url = merge_url.replace("c-101", course_id)

    response = superuser_client.post(url, {"into": "c-102"}, format="json")

    assert response.status_code == 404
    assert ukma_data.received == []
    assert not UkmaDataDecision.objects.exists()


@pytest.mark.django_db
@pytest.mark.integration
@pytest.mark.parametrize("into", ["../merge", "c-102?x=1", "c" * 65])
def test_merge_returns_400_for_an_into_unfit_for_the_parser_path(
    superuser_client, ukma_data, merge_url, into
):
    response = superuser_client.post(merge_url, {"into": into}, format="json")

    assert response.status_code == 400
    assert list(response.json()["fields"]) == ["into"]
    assert _posts(ukma_data) == []


@pytest.mark.django_db
@pytest.mark.integration
def test_decide_returns_403_and_records_a_refusal_when_the_key_is_rejected(
    superuser_client, ukma_data, decide_url
):
    ukma_data.reply("/v1/review-cases/rc-101/decide", {"_tag": "Forbidden"}, status=403)

    response = superuser_client.post(decide_url)

    assert response.status_code == 403
    assert response.json()["code"] == "ukma_data_forbidden"
    decision = UkmaDataDecision.objects.get()
    assert decision.outcome == UkmaDataDecisionOutcome.REFUSED
    assert decision.error == "forbidden"


@pytest.mark.django_db
@pytest.mark.integration
def test_merge_records_the_attempt_before_ukma_data_is_called(
    superuser_client, ukma_data, merge_url, monkeypatch
):
    seen_during_call: list[tuple[str, str]] = []

    def merge_course(self, course_id: str, into: str) -> None:
        seen_during_call.extend(UkmaDataDecision.objects.values_list("outcome", "error"))

    monkeypatch.setattr(UkmaDataService, "merge_course", merge_course)

    response = superuser_client.post(merge_url, {"into": "c-102"}, format="json")

    assert response.status_code == 200
    assert seen_during_call == [(UkmaDataDecisionOutcome.FAILED, "no_answer")]
    decision = UkmaDataDecision.objects.get()
    assert decision.outcome == UkmaDataDecisionOutcome.DONE
    assert decision.error == ""
