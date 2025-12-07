import io
import json
import os
from typing import Any

from django.conf import settings
from django.contrib.auth.models import User
from django.test import Client

import structlog

from ._base_api_profiling_command import BaseProfileApiCommand

logger = structlog.get_logger(__name__)


class Command(BaseProfileApiCommand):
    help = "Profile API endpoints performance"

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

    def _profile_all_endpoints(
        self, endpoints: dict[str, dict[str, Any]], client: Client, test_user: User
    ) -> dict[str, Any]:
        dict_results = {}
        cprofile_outputs = []

        for endpoint_name, endpoint_config in endpoints.items():
            self.stdout.write(f"\nProfiling {endpoint_name}...")

            result, cprofile_output = self._process_endpoint(endpoint_config, client, test_user)

            dict_results[endpoint_name] = result

            if self.cprofile_enabled and cprofile_output:
                formatted_output = self._format_cprofile_output(endpoint_name, cprofile_output)
                cprofile_outputs.append(formatted_output)

        return {"results": dict_results, "cprofile_outputs": cprofile_outputs}

    def _format_cprofile_output(self, endpoint_name: str, output: str) -> str:
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

    def _process_endpoint(
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

    def _write_stdout_results(self, results: dict[str, dict[str, Any]]):
        self.stdout.write("\nAPI PROFILING RESULTS\n")
        super()._write_stdout_results(results)
