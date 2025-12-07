import io
import json
import os
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
    help = "Profile API endpoints performance"

    ITERATIONS = 10
    SUCCESSFUL_STATUS_CODES = [200, 201, 204]

    results_output_file = settings.PERFORMANCE_METRICS_FILE
    cprofile_output_file = settings.CPROFILE_OUTPUT_FILE

    def add_arguments(self, parser):
        parser.add_argument(
            "--course-id",
            type=str,
            required=False,
            help="Course ID to profile",
        )
        parser.add_argument(
            "--no-output",
            action="store_true",
            required=False,
            help="Don't write results to file",
        )
        parser.add_argument(
            "--cprofile",
            action="store_true",
            required=False,
            default=True,
            help="Capture CProfile results",
        )

    def handle(self, *args, **options):
        self._initialize_options(options)
        self._import_cprofile_if_needed()

        client = Client()
        test_user = self._setup_test_environment(client)
        endpoints = self._get_endpoints()

        self.stdout.write(f"Profiling {len(endpoints)} endpoints...")

        results = self._profile_all_endpoints(endpoints, client, test_user)
        self._save_results(results)

    def _initialize_options(self, options):
        self.course_id = options["course_id"]
        self.no_output = options["no_output"]
        self.cprofile_enabled = options["cprofile"]

    def _import_cprofile_if_needed(self):
        if self.cprofile_enabled:
            import cProfile
            import pstats

            self.cprofile_module = cProfile
            self.pstats = pstats

    def _setup_test_environment(self, client: Client) -> User:
        self._configure_test_server()
        return self._create_test_user(client)

    def _configure_test_server(self):
        if "testserver" not in settings.ALLOWED_HOSTS:
            settings.ALLOWED_HOSTS.append("testserver")

    def _profile_all_endpoints(
        self, endpoints: dict[str, dict[str, Any]], client: Client, test_user: User
    ) -> dict[str, Any]:
        dict_results = {}
        cprofile_outputs = []

        for endpoint_name, endpoint_config in endpoints.items():
            self.stdout.write(f"\nProfiling {endpoint_name}...")

            result, cprofile_output = self._profile_endpoint(endpoint_config, client, test_user)

            dict_results[endpoint_name] = result

            if self.cprofile_enabled and cprofile_output:
                formatted_output = self._format_cprofile_output(endpoint_name, cprofile_output)
                cprofile_outputs.append(formatted_output)

        return {"results": dict_results, "cprofile_outputs": cprofile_outputs}

    def _format_cprofile_output(self, endpoint_name: str, output: str) -> str:
        """Format cProfile output with endpoint name header."""
        return f"=== {endpoint_name} ===\n{output}\n\n"

    def _save_results(self, results: dict[str, Any]):
        if self.no_output:
            return

        dict_results = results["results"]
        cprofile_outputs = results["cprofile_outputs"]

        self._write_stdout_results(dict_results)
        self._write_json_results(dict_results)
        self.stdout.write(f"\nResults saved to {self.results_output_file}")

        if self.cprofile_enabled and cprofile_outputs:
            self._write_cprofile_output(cprofile_outputs)
            self.stdout.write(f"\nCProfile output saved to {self.cprofile_output_file}")

    def _write_json_results(self, results: dict[str, dict[str, Any]]):
        os.makedirs(self.results_output_file.parent, exist_ok=True)
        with open(self.results_output_file, "w", encoding="utf-8") as f:
            json.dump(results, f, indent=2, ensure_ascii=False)

    def _write_cprofile_output(self, cprofile_outputs: list[str]):
        os.makedirs(self.cprofile_output_file.parent, exist_ok=True)
        with open(self.cprofile_output_file, "w", encoding="utf-8") as f:
            f.write("".join(cprofile_outputs))

    def _get_endpoints(self) -> dict[str, dict[str, Any]]:
        endpoints = self._get_base_endpoints()

        if self.course_id:
            course_endpoints = self._get_course_specific_endpoints()
            endpoints.update(course_endpoints)

        return endpoints

    def _get_base_endpoints(self) -> dict[str, dict[str, Any]]:
        return {
            "course_list": {
                "url_name": "course-list",
                "method": "GET",
                "params": {"page": 1, "page_size": 25},
                "description": "List courses with pagination",
                "requires_auth": True,
                "enabled": True,
            },
            "course_list_filtered": {
                "url_name": "course-list",
                "method": "GET",
                "params": {"page": 1, "page_size": 25, "semester_year": "2024"},
                "description": "List courses with filters",
                "requires_auth": True,
                "enabled": True,
            },
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

    def _get_course_specific_endpoints(self) -> dict[str, dict[str, Any]]:
        return {
            "course_ratings": {
                "url_name": "course-ratings",
                "method": "GET",
                "kwargs": {"course_id": self.course_id},
                "params": {"page": 1, "page_size": 25},
                "description": "List ratings for a course",
                "requires_data": True,
                "requires_auth": True,
                "enabled": True,
            },
            "course_detail": {
                "url_name": "course-detail",
                "method": "GET",
                "kwargs": {"course_id": self.course_id},
                "description": "Get course details",
                "requires_data": True,
                "requires_auth": True,
                "enabled": True,
            },
        }

    def _profile_endpoint(
        self, config: dict[str, Any], client: Client, test_user: User | None = None
    ) -> tuple[dict[str, Any], str | None]:
        url = self._build_endpoint_url(config)
        if isinstance(url, dict):  # Error case
            return url, None

        profiler = self._start_profiler()
        times = self._execute_endpoint_requests(config, client, test_user, url)
        profile_output = self._stop_profiler(profiler)

        if not times:
            return self._create_error_result(config, "No successful requests"), None

        return self._create_success_result(config, times), profile_output

    def _build_endpoint_url(self, config: dict[str, Any]) -> str | dict[str, Any]:
        try:
            url_kwargs = config.get("kwargs", {})
            return reverse(config["url_name"], kwargs=url_kwargs)
        except Exception as e:
            return self._create_error_result(config, f"Failed to reverse URL: {e}")

    def _start_profiler(self):
        if not self.cprofile_enabled:
            return None

        profiler = self.cprofile_module.Profile()
        profiler.enable()
        return profiler

    def _stop_profiler(self, profiler) -> str | None:
        if not profiler:
            return None

        profiler.disable()

        stream = io.StringIO()
        stats = self.pstats.Stats(profiler, stream=stream).sort_stats("cumulative")
        stats.print_stats(20)

        return stream.getvalue().strip()

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
        self.stdout.write("\nAPI PROFILING RESULTS\n")

        self._write_successful_results(results)
        self._write_error_results(results)

    def _write_successful_results(self, results: dict[str, dict[str, Any]]):
        successful_results = [(name, data) for name, data in results.items() if "error" not in data]
        sorted_results = sorted(
            successful_results,
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

    def _write_error_results(self, results: dict[str, dict[str, Any]]):
        errors = [(name, data) for name, data in results.items() if "error" in data]

        if not errors:
            return

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
