import json
import time
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable
from unittest.mock import patch

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import connection
from django.test.utils import CaptureQueriesContext

from rateukma.caching.cache_manager import InMemoryCacheManager
from rating_app.application_schemas.course import CourseFilterCriteria, CourseFilterCriteriaInternal
from rating_app.application_schemas.rating import RatingFilterCriteria
from rating_app.ioc_container.repositories import (
    course_offering_repository,
    course_repository,
    rating_repository,
)
from rating_app.ioc_container.services import course_service, rating_service
from rating_app.models import Course, CourseOfferingSpeciality, Rating, Student
from rating_app.models.choices import SemesterTerm


@dataclass(frozen=True)
class Scenario:
    name: str
    description: str
    executor: Callable[[], Any]
    queryset_builder: Callable[[], Any | None]
    explain_limit: int | None = 25


class Command(BaseCommand):
    help = "Profile representative heavy ORM query paths on the local database"

    def add_arguments(self, parser):
        parser.add_argument(
            "--output",
            type=str,
            default="profiling/query_profiles.json",
            help="Path to write JSON profiling output relative to backend root",
        )
        parser.add_argument(
            "--include-sql",
            action="store_true",
            help="Include captured SQL statements in the JSON output",
        )
        parser.add_argument(
            "--use-local-cache",
            action="store_true",
            help="Use an in-process in-memory cache so warm-cache timings can be measured locally",
        )

    def handle(self, *args, **options):
        self.include_sql = options["include_sql"]
        self.output_path = Path(settings.BASE_DIR) / options["output"]
        self.use_local_cache = options["use_local_cache"]

        scenarios = self._build_scenarios()
        results: dict[str, Any] = {}

        for scenario in scenarios:
            self.stdout.write(f"\nProfiling {scenario.name}...")
            results[scenario.name] = self._profile_scenario(scenario)

        self.output_path.parent.mkdir(parents=True, exist_ok=True)
        self.output_path.write_text(
            json.dumps(results, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )

        self.stdout.write(f"\nSaved profiling results to {self.output_path}")
        self._write_summary(results)

    def _build_scenarios(self) -> list[Scenario]:
        course_filters = self._build_course_filters()
        rating_filters = self._build_rating_filters()

        scenarios: list[Scenario] = [
            Scenario(
                name="courses_default",
                description="Paginated course list with default filters and full mapper prefetch",
                executor=lambda: course_service().filter_courses(
                    CourseFilterCriteria(),
                    paginate=True,
                    prefetch_related=True,
                ),
                queryset_builder=lambda: course_repository()._filter(  # noqa: SLF001
                    CourseFilterCriteriaInternal(),
                    prefetch_related=False,
                ),
            ),
            Scenario(
                name="analytics_default",
                description="Analytics list with shallow course queryset",
                executor=lambda: course_service().filter_courses(
                    CourseFilterCriteria(),
                    paginate=False,
                    prefetch_related=False,
                ),
                queryset_builder=lambda: course_repository()._filter(  # noqa: SLF001
                    CourseFilterCriteriaInternal(),
                    prefetch_related=False,
                ),
                explain_limit=None,
            ),
        ]

        if course_filters is not None:
            scenarios.append(
                Scenario(
                    name="courses_complex",
                    description="Paginated course list with representative semester/credits/structure filters",
                    executor=lambda: course_service().filter_courses(
                        course_filters,
                        paginate=True,
                        prefetch_related=True,
                    ),
                    queryset_builder=lambda: course_repository()._filter(  # noqa: SLF001
                        CourseFilterCriteriaInternal(**course_filters.model_dump()),
                        prefetch_related=False,
                    ),
                )
            )
            scenarios.append(
                Scenario(
                    name="analytics_complex",
                    description="Analytics list with representative semester/credits/structure filters",
                    executor=lambda: course_service().filter_courses(
                        course_filters,
                        paginate=False,
                        prefetch_related=False,
                    ),
                    queryset_builder=lambda: course_repository()._filter(  # noqa: SLF001
                        CourseFilterCriteriaInternal(**course_filters.model_dump()),
                        prefetch_related=False,
                    ),
                    explain_limit=None,
                )
            )

        if rating_filters is not None:
            scenarios.append(
                Scenario(
                    name="ratings_default_popularity",
                    description="Ratings list with default popularity ordering",
                    executor=lambda: rating_service().filter_ratings(
                        rating_filters,
                        paginate=True,
                    ),
                    queryset_builder=lambda: rating_repository()._filter(rating_filters),  # noqa: SLF001
                )
            )
            scenarios.append(
                Scenario(
                    name="ratings_time_desc",
                    description="Ratings list ordered by newest first",
                    executor=lambda: rating_service().filter_ratings(
                        rating_filters.model_copy(update={"time_order": "desc"}),
                        paginate=True,
                    ),
                    queryset_builder=lambda: rating_repository()._filter(  # noqa: SLF001
                        rating_filters.model_copy(update={"time_order": "desc"})
                    ),
                )
            )

        sample_course_id = self._get_sample_course_id()
        if sample_course_id is not None:
            scenarios.append(
                Scenario(
                    name="offerings_by_course",
                    description="Course offering lookup for one representative course",
                    executor=lambda: course_offering_repository().get_by_course(sample_course_id),
                    queryset_builder=lambda: course_offering_repository()
                    ._build_base_queryset()  # noqa: SLF001
                    .filter(course_id=sample_course_id),
                )
            )

        return scenarios

    def _profile_scenario(self, scenario: Scenario) -> dict[str, Any]:
        result: dict[str, Any] = {
            "description": scenario.description,
        }

        queryset = scenario.queryset_builder()
        if queryset is None:
            result["skipped"] = "Representative local data for this scenario was not found"
            return result

        fetch_queryset = queryset if scenario.explain_limit is None else queryset[: scenario.explain_limit]
        result["explain"] = {
            "page_fetch": self._explain_queryset(fetch_queryset),
            "count": self._explain_count(queryset),
        }
        result["runtime"] = self._measure_execution(scenario.executor)
        return result

    def _measure_execution(self, executor: Callable[[], Any]) -> dict[str, Any]:
        with self._cache_context():
            cold = self._measure_single_execution(executor)
            warm = self._measure_single_execution(executor)

        return {
            "cold": cold,
            "warm": warm,
        }

    def _measure_single_execution(self, executor: Callable[[], Any]) -> dict[str, Any]:
        with CaptureQueriesContext(connection) as queries:
            started = time.perf_counter()
            payload = executor()
            elapsed_ms = (time.perf_counter() - started) * 1000

        result = {
            "elapsed_ms": round(elapsed_ms, 2),
            "query_count": len(queries),
            "payload_type": type(payload).__name__,
        }
        if self.include_sql:
            result["sql"] = [item["sql"] for item in queries.captured_queries]
        return result

    @contextmanager
    def _cache_context(self):
        if not self.use_local_cache:
            yield
            return

        cache_manager = InMemoryCacheManager()
        cache_manager.clear()
        with patch("rateukma.caching.decorators.redis_cache_manager", return_value=cache_manager):
            yield

    def _explain_queryset(self, queryset) -> dict[str, Any]:
        raw = queryset.explain(
            analyze=True,
            buffers=True,
            verbose=True,
            format="json",
        )
        return self._summarize_explain(raw)

    def _explain_count(self, queryset) -> dict[str, Any]:
        sql, params = queryset.query.sql_with_params()
        explain_sql = (
            "EXPLAIN (ANALYZE, BUFFERS, VERBOSE, FORMAT JSON) "
            f"SELECT COUNT(*) FROM ({sql}) query_to_count"
        )
        with connection.cursor() as cursor:
            cursor.execute(explain_sql, params)
            row = cursor.fetchone()
        raw = row[0] if row else []
        return self._summarize_explain(raw)

    def _summarize_explain(self, raw: str | list[dict[str, Any]]) -> dict[str, Any]:
        data = json.loads(raw) if isinstance(raw, str) else raw
        top = data[0]
        plan = top["Plan"]
        summary = {
            "planning_time_ms": round(top.get("Planning Time", 0.0), 3),
            "execution_time_ms": round(top.get("Execution Time", 0.0), 3),
            "node_type": plan.get("Node Type"),
            "startup_cost": plan.get("Startup Cost"),
            "total_cost": plan.get("Total Cost"),
            "plan_rows": plan.get("Plan Rows"),
            "shared_hit_blocks": plan.get("Shared Hit Blocks"),
            "shared_read_blocks": plan.get("Shared Read Blocks"),
            "temp_read_blocks": plan.get("Temp Read Blocks"),
            "temp_written_blocks": plan.get("Temp Written Blocks"),
            "plan": data,
        }
        return summary

    def _write_summary(self, results: dict[str, Any]) -> None:
        self.stdout.write("\nQUERY PROFILE SUMMARY")
        for name, result in results.items():
            if "skipped" in result:
                self.stdout.write(f"\n{name}: skipped ({result['skipped']})")
                continue

            runtime = result["runtime"]
            fetch = result["explain"]["page_fetch"]
            count = result["explain"]["count"]
            self.stdout.write(f"\n{name}")
            self.stdout.write(f"  {result['description']}")
            self.stdout.write(
                "  Cold runtime: "
                f"{runtime['cold']['elapsed_ms']}ms across {runtime['cold']['query_count']} SQL statements"
            )
            self.stdout.write(
                "  Warm runtime: "
                f"{runtime['warm']['elapsed_ms']}ms across {runtime['warm']['query_count']} SQL statements"
            )
            self.stdout.write(
                f"  Fetch plan: {fetch['execution_time_ms']}ms, top node={fetch['node_type']}"
            )
            self.stdout.write(
                f"  Count plan: {count['execution_time_ms']}ms, top node={count['node_type']}"
            )

    def _build_course_filters(self) -> CourseFilterCriteria | None:
        sample = (
            CourseOfferingSpeciality.objects.select_related(
                "offering__course__department__faculty",
                "offering__semester",
                "speciality",
            )
            .filter(offering__course__isnull=False)
            .order_by("offering__course_id")
            .first()
        )
        if sample is None:
            return None

        offering = sample.offering
        course = offering.course
        semester = offering.semester

        if semester.term == SemesterTerm.FALL:
            year = f"{semester.year}–{semester.year + 1}"
        else:
            year = f"{semester.year - 1}–{semester.year}"

        instructor_id = (
            offering.instructors.order_by("id").values_list("id", flat=True).first()
        )

        payload: dict[str, Any] = {
            "faculty": course.department.faculty_id,
            "department": course.department_id,
            "speciality": sample.speciality_id,
            "semester_year": year,
            "semester_terms": [semester.term],
            "credits_min": offering.credits,
            "credits_max": offering.credits,
        }
        if sample.type_kind:
            payload["type_kind"] = sample.type_kind
        if instructor_id:
            payload["instructor"] = instructor_id

        return CourseFilterCriteria.model_validate(payload)

    def _build_rating_filters(self) -> RatingFilterCriteria | None:
        course_id = (
            Rating.objects.order_by("course_offering__course_id")
            .values_list("course_offering__course_id", flat=True)
            .first()
        )
        if course_id is None:
            return None

        viewer_id = Student.objects.order_by("id").values_list("id", flat=True).first()
        payload: dict[str, Any] = {
            "course_id": course_id,
            "page": 1,
            "page_size": 25,
        }
        if viewer_id is not None:
            payload["viewer_id"] = viewer_id

        return RatingFilterCriteria.model_validate(payload)

    def _get_sample_course_id(self):
        return Course.objects.order_by("id").values_list("id", flat=True).first()
