import time
from typing import Any, cast

from django.conf import settings
from django.contrib.auth.models import User
from django.core.management.base import BaseCommand
from django.http import HttpResponseBase
from django.test import Client
from django.urls import reverse

import structlog

from rating_app.models import Speciality, Student

logger = structlog.get_logger(__name__)


class Command(BaseCommand):
    help = "Warm up API endpoints"

    ITERATIONS = 10
    SUCCESSFUL_STATUS_CODES = [200, 201, 204]

    def add_arguments(self, parser):
        pass

    def handle(self, *args, **options):
        client = Client()
        test_user = self._setup_test_environment(client)
        endpoints = self._get_endpoints()

        self.stdout.write(f"Warming up {len(endpoints)} endpoints ->")
        results = self._warmup_endpoints(endpoints, client, test_user)
        self._write_stdout_results(results)

    def _setup_test_environment(self, client: Client) -> User:
        self._configure_test_server()
        return self._create_test_user(client)

    def _configure_test_server(self):
        if "testserver" not in settings.ALLOWED_HOSTS:
            settings.ALLOWED_HOSTS.append("testserver")

    def _warmup_endpoints(
        self, endpoints: dict[str, dict[str, Any]], client: Client, test_user: User
    ) -> dict[str, dict[str, Any]]:
        dict_results = {}

        for endpoint_name, endpoint_config in endpoints.items():
            self.stdout.write(f"Warming up {endpoint_name}...")

            result = self._warmup_endpoint(endpoint_config, client, test_user)
            dict_results[endpoint_name] = result

        return dict_results

    def _get_endpoints(self) -> dict[str, dict[str, Any]]:
        return self._get_base_endpoints()

    def _get_base_endpoints(self) -> dict[str, dict[str, Any]]:
        return {
            "course_filter_options": {
                "url_name": "course-filter-options",
                "method": "GET",
                "description": "Get filter options for courses",
                "requires_auth": True,
                "enabled": True,
            },
            "analytics_list": {
                "url_name": "analytics-list",
                "method": "GET",
                "description": "List analytics data",
                "requires_auth": True,
                "enabled": True,
            },
            "student_courses_stats": {
                "url_name": "student-courses-stats",
                "method": "GET",
                "description": "Get student's course statistics",
                "requires_auth": True,
                "enabled": True,
            },
        }

    def _warmup_endpoint(
        self, config: dict[str, Any], client: Client, test_user: User | None = None
    ) -> dict[str, Any]:
        url = self._build_endpoint_url(config)
        if isinstance(url, dict):  # Error case
            return url

        times = self._execute_endpoint_requests(config, client, test_user, url)

        if not times:
            return self._create_error_result(config, "No successful requests")

        return self._create_success_result(config, times)

    def _build_endpoint_url(self, config: dict[str, Any]) -> str | dict[str, Any]:
        try:
            url_kwargs = config.get("kwargs", {})
            return reverse(config["url_name"], kwargs=url_kwargs)
        except Exception as e:
            return self._create_error_result(config, f"Failed to reverse URL: {e}")

    def _execute_endpoint_requests(
        self, config: dict[str, Any], client: Client, test_user: User | None, url: str
    ) -> list[float]:
        requires_auth = config.get("requires_auth", False)
        if requires_auth and not test_user:
            return []

        times = []
        for i in range(self.ITERATIONS):
            execution_time = self._execute_single_request(config, client, url, i)
            if execution_time is not None:
                times.append(execution_time)

        return times

    def _execute_single_request(
        self, config: dict[str, Any], client: Client, url: str, iteration: int
    ) -> float | None:
        start_time = time.time()

        try:
            response = self._make_http_request(config, client, url)

            if not self._is_successful_response(response):
                self.stderr.write(
                    f"Request {iteration + 1} failed with status {response.status_code}"
                )
                return None

            execution_time = time.time() - start_time
            return execution_time * 1000  # Convert to milliseconds

        except Exception as e:
            self.stderr.write(f"Request {iteration + 1} failed: {e}")
            return None

    def _make_http_request(
        self, config: dict[str, Any], client: Client, url: str
    ) -> HttpResponseBase:
        method = config.get("method", "GET")
        params = config.get("params", {})
        headers = {}

        if method == "GET":
            response = client.get(url, params, **headers)
        elif method == "POST":
            response = client.post(url, params, **headers)
        else:
            response = client.generic(method, url, params, **headers)

        return cast(HttpResponseBase, response)

    def _is_successful_response(self, response: HttpResponseBase) -> bool:
        return response.status_code in self.SUCCESSFUL_STATUS_CODES

    def _create_error_result(self, config: dict[str, Any], error_message: str) -> dict[str, Any]:
        return {
            "error": error_message,
            "description": config.get("description", ""),
        }

    def _create_success_result(self, config: dict[str, Any], times: list[float]) -> dict[str, Any]:
        return {
            "description": config.get("description", ""),
            "iterations": len(times),
            "avg_time_ms": round(sum(times) / len(times), 2),
            "min_time_ms": round(min(times), 2),
            "max_time_ms": round(max(times), 2),
            "total_time_ms": round(sum(times), 2),
            "times": [round(t, 2) for t in times],
        }

    def _write_stdout_results(self, results: dict[str, dict[str, Any]]):
        self.stdout.write("\n=== API WARMUP RESULTS ===\n")

        successful_results = self._get_successful_results(results)
        error_results = self._get_error_results(results)

        if successful_results:
            self._write_successful_results_section(successful_results)

        if error_results:
            self._write_error_results_section(error_results)

    def _get_successful_results(
        self, results: dict[str, dict[str, Any]]
    ) -> list[tuple[str, dict[str, Any]]]:
        successful = [(name, data) for name, data in results.items() if "error" not in data]
        return sorted(successful, key=lambda x: x[1]["avg_time_ms"], reverse=True)

    def _get_error_results(
        self, results: dict[str, dict[str, Any]]
    ) -> list[tuple[str, dict[str, Any]]]:
        return [(name, data) for name, data in results.items() if "error" in data]

    def _write_successful_results_section(self, results: list[tuple[str, dict[str, Any]]]):
        for endpoint_name, data in results:
            self._write_endpoint_result(endpoint_name, data)

    def _write_endpoint_result(self, endpoint_name: str, data: dict[str, Any]):
        self.stdout.write(f"\n{endpoint_name}")
        self.stdout.write(f"  Description: {data['description']}")
        self.stdout.write(f"  Iterations: {data['iterations']}")
        self.stdout.write(f"  Avg Time: {data['avg_time_ms']}ms")
        self.stdout.write(f"  Min/Max: {data['min_time_ms']}ms / {data['max_time_ms']}ms")
        self.stdout.write(f"  Total Time: {data['total_time_ms']}ms")

    def _write_error_results_section(self, errors: list[tuple[str, dict[str, Any]]]):
        """Write error results section."""
        self.stdout.write(f"\n\n=== ERRORS ({len(errors)}) ===")
        for endpoint_name, data in errors:
            self.stdout.write(f"  {endpoint_name}: {data['error']}")

    def _create_test_user(self, client: Client) -> User:
        speciality = self._get_speciality()
        test_user = self._get_or_create_user()
        self._get_or_create_student(test_user, speciality)
        self._configure_user_auth(test_user, client)

        return test_user

    def _get_speciality(self) -> Speciality:
        speciality = Speciality.objects.all().first()
        if speciality is None:
            raise Exception("No specialities found")
        return speciality

    def _get_or_create_user(self) -> User:
        """Get or create test user."""
        test_user, _ = User.objects.get_or_create(
            username="test_profiler",
            defaults={
                "email": "test@ukma.edu.ua",
                "is_staff": False,
                "is_superuser": False,
            },
        )
        return test_user

    def _get_or_create_student(self, user: User, speciality: Speciality):
        Student.objects.get_or_create(
            user=user,
            defaults={
                "first_name": "Test",
                "last_name": "Profiler",
                "email": "test@ukma.edu.ua",
                "speciality": speciality,
            },
        )

    def _configure_user_auth(self, user: User, client: Client):
        user.set_password("testpass123")
        user.save()
        client.force_login(user)
