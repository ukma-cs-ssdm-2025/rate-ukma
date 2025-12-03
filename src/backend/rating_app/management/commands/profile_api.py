import cProfile
import io
import json
import os
import pstats
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
    iterations = 10
    results_output_file = settings.PERFORMANCE_METRICS_FILE
    cprofile_output_file = settings.CPROFILE_OUTPUT_FILE

    def add_arguments(self, parser):
        parser.add_argument(
            "--course-id",
            type=str,
            required=True,
            help="Course ID to profile",
        )

    def handle(self, *args, **options):
        self.course_id = options["course_id"]

        dict_results = {}
        cprofile_outputs = []
        client = Client()

        test_user = self._create_test_user(client)
        self._configure_test_server()
        endpoints = self._get_endpoints()

        self.stdout.write(f"Profiling {len(endpoints)} endpoints...")

        for endpoint_name, endpoint_config in endpoints.items():
            self.stdout.write(f"\nProfiling {endpoint_name}...")
            dict_result, cprofile_output = self._profile_endpoint(
                endpoint_config, client, test_user
            )
            dict_results[endpoint_name] = dict_result

            if cprofile_output:
                cprofile_outputs.append(f"=== {endpoint_name} ===\n{cprofile_output}\n\n")

        self._write_stdout_results(dict_results)
        self._write_json_results(dict_results)

        if cprofile_outputs:
            self._write_cprofile_output(cprofile_outputs)
            self.stdout.write(f"\nCProfile output saved to {self.cprofile_output_file}")

        self.stdout.write(f"\nResults saved to {self.results_output_file}")

    def _configure_test_server(self):
        if "testserver" not in settings.ALLOWED_HOSTS:
            settings.ALLOWED_HOSTS.append("testserver")

    def _write_json_results(self, results: dict[str, dict[str, Any]]):
        os.makedirs(self.results_output_file.parent, exist_ok=True)
        with open(self.results_output_file, "w", encoding="utf-8") as f:
            json.dump(results, f, indent=2, ensure_ascii=False)

    def _write_cprofile_output(self, cprofile_outputs: list[str]):
        os.makedirs(self.cprofile_output_file.parent, exist_ok=True)
        with open(self.cprofile_output_file, "w", encoding="utf-8") as f:
            f.write("".join(cprofile_outputs))

    def _get_endpoints(self) -> dict[str, dict[str, Any]]:
        all_endpoints = {
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
            "course_detail": {
                "url_name": "course-detail",
                "method": "GET",
                "kwargs": {"course_id": self.course_id},
                "description": "Get course details",
                "requires_data": True,
                "requires_auth": True,
                "enabled": True,
            },
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

        return {
            name: config for name, config in all_endpoints.items() if config.get("enabled", False)
        }

    def _profile_endpoint(
        self, config: dict[str, Any], client: Client, test_user: User | None = None
    ) -> tuple[dict[str, Any], str | None]:
        try:
            url_kwargs = config.get("kwargs", {})
            url = reverse(config["url_name"], kwargs=url_kwargs)
        except Exception as e:
            return (
                {
                    "error": f"Failed to reverse URL: {e}",
                    "description": config.get("description", ""),
                },
                None,
            )

        method = config.get("method", "GET")
        params = config.get("params", {})
        requires_auth = config.get("requires_auth", False)

        times = []
        pr = cProfile.Profile()
        pr.enable()

        for i in range(self.iterations):
            start_time = time.time()

            try:
                headers = {}
                if requires_auth and not test_user:
                    continue

                if method == "GET":
                    response = client.get(url, params, **headers)
                elif method == "POST":
                    response = client.post(url, params, **headers)
                else:
                    response = client.generic(method, url, params, **headers)

                response = cast(HttpResponseBase, response)
                if response.status_code not in [200, 201]:
                    self.stderr.write(f"Request {i + 1} failed with status {response.status_code}")
                    continue

                execution_time = time.time() - start_time
                times.append(execution_time * 1000)

            except Exception as e:
                self.stderr.write(f"Request {i + 1} failed: {e}")
                continue

        pr.disable()
        s = io.StringIO()
        ps = pstats.Stats(pr, stream=s).sort_stats("cumulative")
        ps.print_stats(20)
        profile_output = s.getvalue().strip()

        if not times:
            return (
                {
                    "error": "No successful requests",
                    "description": config.get("description", ""),
                },
                None,
            )

        return (
            {
                "description": config.get("description", ""),
                "iterations": len(times),
                "avg_time_ms": round(sum(times) / len(times), 2),
                "min_time_ms": round(min(times), 2),
                "max_time_ms": round(max(times), 2),
                "total_time_ms": round(sum(times), 2),
                "times": [round(t, 2) for t in times],
            },
            profile_output,
        )

    def _write_stdout_results(self, results: dict[str, dict[str, Any]]):
        self.stdout.write("\nAPI PROFILING RESULTS\n")

        sorted_results = sorted(
            [(name, data) for name, data in results.items() if "error" not in data],
            key=lambda x: x[1]["avg_time_ms"],
            reverse=True,
        )

        for endpoint_name, data in sorted_results:
            self.stdout.write(f"\n{endpoint_name}")
            self.stdout.write(f"  Description: {data['description']}")
            self.stdout.write(f"  Iterations: {data['iterations']}")
            self.stdout.write(f"  Avg Time: {data['avg_time_ms']}ms")
            self.stdout.write(f"  Min/Max: {data['min_time_ms']}ms / {data['max_time_ms']}ms")
            self.stdout.write(f"  Total Time: {data['total_time_ms']}ms")

        errors = [(name, data) for name, data in results.items() if "error" in data]
        if errors:
            self.stdout.write(f"\n\nERRORS ({len(errors)}):")
            for endpoint_name, data in errors:
                self.stdout.write(f"  {endpoint_name}: {data['error']}")

    def _create_test_user(self, client: Client) -> User:
        speciality = Speciality.objects.all().first()
        test_user, created = User.objects.get_or_create(
            username="test_profiler",
            defaults={
                "email": "test@ukma.edu.ua",
                "is_staff": False,
                "is_superuser": False,
            },
        )

        student, _ = Student.objects.get_or_create(
            user=test_user,
            defaults={
                "first_name": "Test",
                "last_name": "Profiler",
                "email": "test@ukma.edu.ua",
                "speciality": speciality,
            },
        )

        test_user.set_password("testpass123")
        test_user.save()

        client.force_login(test_user)

        return test_user
