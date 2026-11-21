import {
	Clock,
	Context,
	DateTime,
	Duration,
	Effect,
	Layer,
	Schema,
} from "effect";
import { SqlClient, SqlSchema } from "effect/sql";
import { CrawlInterval, untilNextCrawl } from "../crawl/crawl.ts";
import { CrawlStore } from "../crawl/CrawlStore.ts";
import { type Stats, YearStats } from "./stats.ts";

const Count = Schema.Int;

/** Totals for an overview, no personal data. Each query counts over indexed
 *  columns once, so the whole read stays cheap at a few tens of thousands of
 *  offerings. */
export class StatsReader extends Context.Service<
	StatsReader,
	{ stats(): Effect.Effect<Stats> }
>()("ukma-data/stats/StatsReader") {
	static readonly layerNoDeps = Layer.effect(
		StatsReader,
		Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			const crawls = yield* CrawlStore;
			const interval = yield* CrawlInterval;

			const findYears = SqlSchema.findAll({
				Request: Schema.Void,
				Result: YearStats,
				execute: () => sql`
					WITH live_offerings AS (
						SELECT id, academic_year, course_id, saz_teachers
						FROM offerings
						WHERE removed_at IS NULL
					),
					per_year AS (
						SELECT o.academic_year,
							count(*)::int AS offerings,
							count(DISTINCT c.id)::int AS courses,
							count(*) FILTER (
								WHERE btrim(coalesce(o.saz_teachers, '')) <> ''
							)::int AS with_teachers
						FROM live_offerings o
						LEFT JOIN courses c ON c.id = o.course_id
							AND c.merged_into IS NULL AND c.removed_at IS NULL
						GROUP BY o.academic_year
					),
					enrolled AS (
						SELECT o.academic_year,
							count(DISTINCT sp.student_id)::int AS students,
							count(*)::int AS enrollments
						FROM enrollments e
						JOIN live_offerings o ON o.id = e.offering_id
						JOIN student_programmes sp ON sp.id = e.student_programme_id
						WHERE e.removed_at IS NULL AND e.status = 'enrolled'
						GROUP BY o.academic_year
					)
					SELECT y.academic_year AS "academicYear", y.offerings, y.courses,
						coalesce(e.students, 0) AS students,
						coalesce(e.enrollments, 0) AS enrollments,
						y.with_teachers::float8 / y.offerings AS "teacherShare"
					FROM per_year y
					LEFT JOIN enrolled e USING (academic_year)
					ORDER BY y.academic_year DESC
				`,
			});

			const findOverall = SqlSchema.findOne({
				Request: Schema.Void,
				Result: Schema.Struct({
					mergedByRule: Count,
					mergedByDecision: Count,
					courseMatch: Count,
					instructorMatch: Count,
					studentMatch: Count,
					removalsHeld: Count,
					finishedAt: Schema.NullOr(Schema.Date),
					status: Schema.NullOr(Schema.Literals(["succeeded", "failed"])),
				}),
				execute: () => sql`
					SELECT
						m.rule AS "mergedByRule", m.decision AS "mergedByDecision",
						r.course_match AS "courseMatch",
						r.instructor_match AS "instructorMatch",
						r.student_match AS "studentMatch",
						r.removals_held AS "removalsHeld",
						l.finished_at AS "finishedAt", l.status
					FROM (
						SELECT
							count(*) FILTER (WHERE merge_source = 'rule')::int AS rule,
							count(*) FILTER (WHERE merge_source = 'decision')::int AS decision
						FROM courses WHERE merged_into IS NOT NULL
					) m
					CROSS JOIN (
						SELECT
							count(*) FILTER (WHERE kind = 'course_match')::int AS course_match,
							count(*) FILTER (WHERE kind = 'instructor_match')::int AS instructor_match,
							count(*) FILTER (WHERE kind = 'student_match')::int AS student_match,
							count(*) FILTER (WHERE kind = 'removals_held')::int AS removals_held
						FROM review_cases WHERE status = 'open'
					) r
					LEFT JOIN LATERAL (
						SELECT finished_at, status FROM runs
						WHERE finished_at IS NOT NULL AND source_part LIKE 'saz-courses:%'
						ORDER BY finished_at DESC
						LIMIT 1
					) l ON true
				`,
			});

			const stats = Effect.fn("StatsReader.stats")(function* () {
				const [years, overall, wait, now] = yield* Effect.all([
					findYears(),
					findOverall(),
					untilNextCrawl(interval, undefined),
					Clock.currentTimeMillis,
				]).pipe(Effect.provideService(CrawlStore, crawls), Effect.orDie);

				return {
					years,
					mergedCourses: {
						rule: overall.mergedByRule,
						decision: overall.mergedByDecision,
					},
					openReviewCases: {
						courseMatch: overall.courseMatch,
						instructorMatch: overall.instructorMatch,
						studentMatch: overall.studentMatch,
						removalsHeld: overall.removalsHeld,
					},
					lastCrawl:
						overall.finishedAt === null || overall.status === null
							? null
							: { finishedAt: overall.finishedAt, status: overall.status },
					nextCrawlAt: DateTime.toDate(
						DateTime.makeUnsafe(now + Duration.toMillis(wait)),
					),
				};
			});

			return StatsReader.of({ stats });
		}),
	);

	static readonly layer = StatsReader.layerNoDeps.pipe(
		Layer.provide(CrawlStore.layer),
	);
}
