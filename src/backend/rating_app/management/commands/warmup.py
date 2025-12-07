from typing import Any

from django.contrib.auth.models import User
from django.test import Client

from ._base_api_profiling_command import BaseProfileApiCommand


class Command(BaseProfileApiCommand):
    help = "Warm up API endpoints"

    def add_arguments(self, parser):
        pass

    def handle(self, *args, **options):
        client = Client()
        test_user = self._setup_test_environment(client)
        endpoints = self._get_endpoints()

        self.stdout.write(f"Warming up {len(endpoints)} endpoints ->")
        results = self._warmup_endpoints(endpoints, client, test_user)
        self._write_stdout_results(results)

    def _warmup_endpoints(
        self, endpoints: dict[str, dict[str, Any]], client: Client, test_user
    ) -> dict[str, dict[str, Any]]:
        dict_results = {}

        for endpoint_name, endpoint_config in endpoints.items():
            self.stdout.write(f"Warming up {endpoint_name}...")

            result, _ = self._process_endpoint(endpoint_config, client, test_user)
            dict_results[endpoint_name] = result

        return dict_results

    def _get_endpoints(self) -> dict[str, dict[str, Any]]:
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

    def _write_stdout_results(self, results: dict[str, dict[str, Any]]):
        self.stdout.write("\n=== API WARMUP RESULTS ===\n")
        super()._write_stdout_results(results)

    def _process_endpoint(
        self, config: dict[str, Any], client: Client, test_user: User | None = None
    ) -> tuple[dict[str, Any], Any]:
        url = self._build_endpoint_url(config)
        if isinstance(url, dict):
            return url, None

        times = self._execute_endpoint_requests(config, client, test_user, url)
        if not times:
            return self._create_error_result(config, "No successful requests"), None

        return self._create_success_result(config, times), None
