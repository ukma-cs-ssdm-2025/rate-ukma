"""
Load testing scenarios for Rate UKMA.

All endpoints require authentication, so every simulated user gets a session.

Usage:
    1. On the remote server, generate sessions:
       docker exec <container> python manage.py create_load_test_sessions --count 200

    2. Copy the JSON file locally:
       scp user@server:/path/to/load_test_sessions.json src/backend/load_test_sessions.json

    3. Run Locust:
       uv run locust -f locustfile.py --host=https://your-server.com

    4. Open http://localhost:8089 and configure 100-200 users.
"""

import json
import logging
import random
from pathlib import Path

from locust import HttpUser, between, events, task

logger = logging.getLogger(__name__)

SESSION_FILE = Path(__file__).parent.parent / "load_test_sessions.json"

_sessions: list[dict] = []
_session_index = 0


@events.init.add_listener
def on_init(environment, **kwargs):
    global _sessions
    if not SESSION_FILE.exists():
        logger.error(
            "Session file %s not found. Run create_load_test_sessions first.", SESSION_FILE
        )
        return
    with open(SESSION_FILE) as f:
        _sessions = json.load(f)
    logger.info("Loaded %d sessions from %s", len(_sessions), SESSION_FILE)


def _claim_session() -> dict | None:
    """Assign a unique session to each simulated user (round-robin)."""
    global _session_index
    if not _sessions:
        return None
    session = _sessions[_session_index % len(_sessions)]
    _session_index += 1
    return session


# ── Shared state caches ────────────────────────────────────────────────

_course_ids: list[str] = []
_course_offering_ids: list[str] = []
_rating_ids: list[str] = []

API = "/api/v1"


class _AuthenticatedBase(HttpUser):
    """Base class that sets up session cookies for all users."""

    abstract = True

    def on_start(self):
        self._session = _claim_session()
        if not self._session:
            self._csrf_token = ""
            logger.warning("No session available for user — requests will fail with 403.")
            return

        self.client.cookies.set("sessionid", self._session["sessionid"])
        self.client.cookies.set("csrftoken", self._session["csrftoken"])
        self._csrf_token = self._session["csrftoken"]

        # Validate session is still alive
        resp = self.client.get(f"{API}/auth/session/", name="[setup] session check")
        if resp.status_code != 200:
            logger.error(
                "Session validation failed for %s: %s %s",
                self._session["username"],
                resp.status_code,
                resp.text[:200],
            )
        else:
            logger.info("Session OK for %s", self._session["username"])

    def _auth_headers(self) -> dict:
        return {"X-CSRFToken": self._csrf_token, "Content-Type": "application/json"}

    def _random_course_id(self) -> str | None:
        return random.choice(_course_ids) if _course_ids else None


class BrowsingUser(_AuthenticatedBase):
    """
    Simulates a logged-in user browsing courses and ratings (read-only).
    Weight 3 — most traffic is browsing.
    """

    weight = 3
    wait_time = between(1, 5)

    @task(5)
    def list_courses(self):
        page = random.randint(1, 5)
        with self.client.get(
            f"{API}/courses/", params={"page": page}, catch_response=True, name="/courses/"
        ) as resp:
            if resp.status_code == 200:
                data = resp.json()
                for course in data.get("results", []):
                    cid = course.get("id")
                    if cid and cid not in _course_ids:
                        _course_ids.append(cid)

    @task(3)
    def view_course_detail(self):
        course_id = self._random_course_id()
        if not course_id:
            return
        self.client.get(f"{API}/courses/{course_id}/", name="/courses/[id]/")

    @task(3)
    def view_course_ratings(self):
        course_id = self._random_course_id()
        if not course_id:
            return
        with self.client.get(
            f"{API}/courses/{course_id}/ratings/",
            name="/courses/[id]/ratings/",
            catch_response=True,
        ) as resp:
            if resp.status_code == 200:
                data = resp.json()
                for rating in data.get("results", []):
                    rid = rating.get("id")
                    if rid and rid not in _rating_ids:
                        _rating_ids.append(rid)
                    offering = rating.get("course_offering")
                    if offering and offering not in _course_offering_ids:
                        _course_offering_ids.append(offering)

    @task(2)
    def view_filter_options(self):
        self.client.get(f"{API}/courses/filter-options/", name="/courses/filter-options/")

    @task(1)
    def view_course_offerings(self):
        course_id = self._random_course_id()
        if not course_id:
            return
        with self.client.get(
            f"{API}/courses/{course_id}/offerings/",
            name="/courses/[id]/offerings/",
            catch_response=True,
        ) as resp:
            if resp.status_code == 200:
                data = resp.json()
                for offering in data.get("results", data if isinstance(data, list) else []):
                    oid = offering.get("id") if isinstance(offering, dict) else None
                    if oid and oid not in _course_offering_ids:
                        _course_offering_ids.append(oid)

    @task(1)
    def view_analytics(self):
        self.client.get(f"{API}/analytics/", name="/analytics/")


class ActiveUser(_AuthenticatedBase):
    """
    Simulates an authenticated student performing write operations
    (rating, voting) alongside browsing.
    Weight 1 — fewer users perform writes.
    """

    weight = 1
    wait_time = between(2, 6)

    # ── Browse tasks ─────────────────────────────────────────────────

    @task(5)
    def list_courses(self):
        page = random.randint(1, 5)
        with self.client.get(
            f"{API}/courses/", params={"page": page}, catch_response=True, name="/courses/"
        ) as resp:
            if resp.status_code == 200:
                data = resp.json()
                for course in data.get("results", []):
                    cid = course.get("id")
                    if cid and cid not in _course_ids:
                        _course_ids.append(cid)

    @task(3)
    def view_course_detail(self):
        course_id = self._random_course_id()
        if not course_id:
            return
        self.client.get(f"{API}/courses/{course_id}/", name="/courses/[id]/")

    @task(3)
    def view_course_ratings(self):
        course_id = self._random_course_id()
        if not course_id:
            return
        with self.client.get(
            f"{API}/courses/{course_id}/ratings/",
            name="/courses/[id]/ratings/",
            catch_response=True,
        ) as resp:
            if resp.status_code == 200:
                data = resp.json()
                for rating in data.get("results", []):
                    rid = rating.get("id")
                    if rid and rid not in _rating_ids:
                        _rating_ids.append(rid)
                    offering = rating.get("course_offering")
                    if offering and offering not in _course_offering_ids:
                        _course_offering_ids.append(offering)

    # ── Write tasks ──────────────────────────────────────────────────

    @task(2)
    def check_session(self):
        self.client.get(f"{API}/auth/session/", name="/auth/session/")

    @task(2)
    def view_my_ratings(self):
        self.client.get(f"{API}/students/me/courses/", name="/students/me/courses/")

    @task(1)
    def create_rating(self):
        if not _course_offering_ids or not _course_ids:
            return
        course_id = random.choice(_course_ids)
        offering_id = random.choice(_course_offering_ids)
        payload = {
            "course_offering": offering_id,
            "difficulty": random.randint(1, 5),
            "usefulness": random.randint(1, 5),
            "comment": f"Load test rating {random.randint(0, 99999)}",
            "is_anonymous": random.choice([True, False]),
        }
        self.client.post(
            f"{API}/courses/{course_id}/ratings/",
            json=payload,
            headers=self._auth_headers(),
            name="/courses/[id]/ratings/ [POST]",
        )

    @task(2)
    def vote_on_rating(self):
        if not _rating_ids:
            return
        rating_id = random.choice(_rating_ids)
        payload = {"vote_type": random.choice(["UPVOTE", "DOWNVOTE"])}
        self.client.put(
            f"{API}/ratings/{rating_id}/votes/",
            json=payload,
            headers=self._auth_headers(),
            name="/ratings/[id]/votes/ [PUT]",
        )
