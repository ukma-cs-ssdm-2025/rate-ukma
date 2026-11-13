import {
	Cause,
	Clock,
	Duration,
	Effect,
	Layer,
	Result,
	Schedule,
	Schema,
} from "effect";
import { SqlClient } from "effect/sql";
import { ChangeLog } from "../changes/ChangeLog.ts";
import { CrawlInterval, crawlYears, untilNextCrawl } from "../crawl/crawl.ts";
import { CrawlStore } from "../crawl/CrawlStore.ts";
import { parseOfferings, storeFailureOf } from "../offerings/offerings.ts";
import { OfferingStore } from "../offerings/OfferingStore.ts";
import { RemovalStore } from "../offerings/RemovalStore.ts";
import { RemovalThreshold, removeOfferings } from "../offerings/removals.ts";
import { SazClient, SazSignInFailed } from "../saz/SazClient.ts";
import { parseStudents } from "../students/students.ts";
import { StudentStore } from "../students/StudentStore.ts";

const signInFailed = (cause: Cause.Cause<unknown>) => {
	const error = Cause.findError(cause);

	return Result.isSuccess(error) && Schema.is(SazSignInFailed)(error.success);
};

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
			Effect.as(true),
			Effect.catch((cause) =>
				Effect.logError("Crawl failed", cause).pipe(
					Effect.as(!signInFailed(cause)),
				),
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
		);

		// A lost database must not end the loop, so a failed read is tried
		// again a minute later.
		const nextCrawlIn = (sinceTry: Duration.Duration | undefined) =>
			untilNextCrawl(interval, sinceTry).pipe(
				Effect.catchCause((cause) =>
					Effect.logError("Reading the crawl schedule failed", cause).pipe(
						Effect.as(undefined),
					),
				),
			);

		// Crawls on a schedule kept in the runs, so a restart neither crawls
		// again early nor loses a crawl it cut short.
		yield* Effect.gen(function* () {
			let triedAt: number | undefined;
			let parsedOnStart = false;

			while (true) {
				const now = yield* Clock.currentTimeMillis;

				const wait = yield* nextCrawlIn(
					triedAt === undefined ? undefined : Duration.millis(now - triedAt),
				);

				if (wait === undefined) {
					yield* Effect.sleep("1 minute");
					continue;
				}

				if (!Duration.isZero(wait)) {
					// A restart between a crawl and its parse would leave the stored
					// pages unapplied until the next crawl.
					// The parse takes time, so the wait is read again after it.
					if (triedAt === undefined && !parsedOnStart) {
						parsedOnStart = true;
						yield* parse;
						continue;
					}

					yield* Effect.logInfo("Next crawl scheduled", {
						at: new Date(now + Duration.toMillis(wait)).toISOString(),
					});
					yield* Effect.sleep(wait);
				}

				triedAt = yield* Clock.currentTimeMillis;

				const signedIn = yield* crawl;

				yield* parse;

				if (!signedIn) {
					return yield* Effect.logError(
						"Crawling stopped until the worker restarts: the САЗ sign-in failed",
					);
				}
			}
		}).pipe(Effect.forkScoped);
	}),
).pipe(
	Layer.provide([
		CrawlStore.layer,
		OfferingStore.layer,
		RemovalStore.layer,
		SazClient.layer,
		StudentStore.layer,
	]),
	Layer.provide(ChangeLog.layer),
);
