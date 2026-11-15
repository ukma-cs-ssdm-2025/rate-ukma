import { Cause, type Duration, Effect, Layer, Schedule } from "effect";
import { SqlClient } from "effect/sql";
import { ChangeLog } from "../changes/ChangeLog.ts";
import { CourseStore } from "../courses/CourseStore.ts";
import { CrawlInterval, crawlYears, untilNextCrawl } from "../crawl/crawl.ts";
import { CrawlStore } from "../crawl/CrawlStore.ts";
import { parseOfferings, storeFailureOf } from "../offerings/offerings.ts";
import { OfferingStore } from "../offerings/OfferingStore.ts";
import { RemovalStore } from "../offerings/RemovalStore.ts";
import { RemovalThreshold, removeOfferings } from "../offerings/removals.ts";
import { SazClient } from "../saz/SazClient.ts";
import { parseStudents } from "../students/students.ts";
import { StudentStore } from "../students/StudentStore.ts";
import { crawlLoop } from "./crawlLoop.ts";

export const WorkerLive = Layer.effectDiscard(
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		const threshold = yield* RemovalThreshold;

		yield* sql`SELECT 1`;
		yield* Effect.logInfo("Worker connected to Postgres");

		yield* sql`SELECT 1`.pipe(
			Effect.andThen(Effect.logInfo("Worker tick")),
			Effect.catch((error) => Effect.logError("Postgres check failed", error)),
			Effect.repeat(Schedule.spaced("1 minute")),
			Effect.forkScoped,
		);

		const interval = yield* CrawlInterval;

		// A crash, such as a lost database, leaves the runs open, so a later try
		// resumes them. `false` after a failed sign-in, which is not tried again,
		// as each try would send the password.
		const crawl = crawlYears().pipe(
			Effect.as(true),
			Effect.catchTag("SazSignInFailed", (error) =>
				Effect.logError("Crawl failed", error).pipe(Effect.as(false)),
			),
			Effect.sandbox,
			Effect.tapError((cause) =>
				Cause.hasDies(cause)
					? Effect.logError("Crawl crashed, resuming later", cause)
					: Effect.void,
			),
			Effect.retry({
				while: Cause.hasDies,
				schedule: Schedule.exponential("1 minute").pipe(
					Schedule.upTo({ times: 5 }),
				),
			}),
			Effect.catch((cause) =>
				Effect.logError("Crawl failed", cause).pipe(Effect.as(true)),
			),
		);

		const parse = parseOfferings("crawl").pipe(
			Effect.catchCause((cause) =>
				Effect.logError("Parsing offerings failed", cause),
			),
			Effect.andThen(parseStudents("crawl")),
			Effect.catchCause((cause) =>
				Effect.logError("Parsing students failed", {
					error: storeFailureOf(cause),
				}),
			),
			Effect.andThen(removeOfferings(threshold)),
			Effect.catchCause((cause) =>
				Effect.logError("Removing offerings failed", cause),
			),
			Effect.asVoid,
		);

		// A lost database must not end the loop, so a failed read is tried
		// again a minute later.
		const nextWait = (
			triedAt: number | undefined,
		): Effect.Effect<Duration.Duration, never, CrawlStore> =>
			untilNextCrawl(interval, triedAt).pipe(
				Effect.catchCause((cause) =>
					Effect.logError("Reading the crawl schedule failed", cause).pipe(
						Effect.andThen(Effect.sleep("1 minute")),
						Effect.andThen(Effect.suspend(() => nextWait(triedAt))),
					),
				),
			);

		yield* crawlLoop({ nextWait, crawl, parse }).pipe(Effect.forkScoped);
	}),
).pipe(
	Layer.provide([
		CourseStore.layer,
		CrawlStore.layer,
		OfferingStore.layer,
		RemovalStore.layer,
		SazClient.layer,
		StudentStore.layer,
	]),
	Layer.provide(ChangeLog.layer),
);
