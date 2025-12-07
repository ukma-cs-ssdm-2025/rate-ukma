import time
from abc import ABC, abstractmethod
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


class BaseProfileApiCommand(BaseCommand, ABC):
    ITERATIONS = 10
    SUCCESSFUL_STATUS_CODES = [200, 201, 204]

    def _setup_test_environment(self, client: Client) -> User:
        self._configure_test_server()
        return self._create_test_user(client)

    def _configure_test_server(self):
        if "testserver" not in settings.ALLOWED_HOSTS:
            settings.ALLOWED_HOSTS.append("testserver")

    @abstractmethod
    def _get_endpoints(self) -> dict[str, dict[str, Any]]:
        pass

    @abstractmethod
    def _process_endpoint(
        self, config: dict[str, Any], client: Client, test_user: User | None = None
    ) -> tuple[dict[str, Any], Any]:
        pass

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
        successful_results = [(name, data) for name, data in results.items() if "error" not in data]
        error_results = [(name, data) for name, data in results.items() if "error" in data]

        if successful_results:
            self._write_successful_results(successful_results)

        if error_results:
            self._write_error_results(error_results)

    def _write_successful_results(self, results: list[tuple[str, dict[str, Any]]]):
        sorted_results = sorted(
            results,
            key=lambda x: x[1]["avg_time_ms"],
            reverse=True,
        )

        for endpoint_name, data in sorted_results:
            self._write_endpoint_result(endpoint_name, data)

    def _write_endpoint_result(self, endpoint_name: str, data: dict[str, Any]):
        self.stdout.write(f"\n{endpoint_name}")
        self.stdout.write(f"  Description: {data['description']}")
        self.stdout.write(f"  Iterations: {data['iterations']}")
        self.stdout.write(f"  Avg Time: {data['avg_time_ms']}ms")
        self.stdout.write(f"  Min/Max: {data['min_time_ms']}ms / {data['max_time_ms']}ms")
        self.stdout.write(f"  Total Time: {data['total_time_ms']}ms")

    def _write_error_results(self, errors: list[tuple[str, dict[str, Any]]]):
        self.stdout.write(f"\n\nERRORS ({len(errors)}):")
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
