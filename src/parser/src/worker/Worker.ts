import { Cause, Effect, Layer, Schedule } from "effect";
import { SqlClient } from "effect/sql";
import { ChangeLog } from "../changes/ChangeLog.ts";
import { crawlAllYears } from "../crawl/crawl.ts";
import { CrawlStore } from "../crawl/CrawlStore.ts";
import { parseOfferings } from "../offerings/offerings.ts";
import { OfferingStore } from "../offerings/OfferingStore.ts";
import { SazClient } from "../saz/SazClient.ts";

export const WorkerLive = Layer.effectDiscard(
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;

		yield* sql`SELECT 1`;
		yield* Effect.logInfo("Worker connected to Postgres");

		yield* sql`SELECT 1`.pipe(
			Effect.andThen(Effect.logInfo("Worker tick")),
			Effect.catch((error) => Effect.logError("Postgres check failed", error)),
			Effect.repeat(Schedule.spaced("1 minute")),
			Effect.forkScoped,
		);

		// A crash, such as a lost database, leaves the runs open, so a later try
		// resumes them. A failed sign-in is not tried again, as each try would
		// send the password.
		yield* crawlAllYears().pipe(
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
			Effect.catch((cause) => Effect.logError("Crawl failed", cause)),
			Effect.andThen(parseOfferings("crawl")),
			Effect.catchCause((cause) =>
				Effect.logError("Parsing offerings failed", cause),
			),
			Effect.forkScoped,
		);
	}),
).pipe(
	Layer.provide([CrawlStore.layer, OfferingStore.layer, SazClient.layer]),
	Layer.provide(ChangeLog.layer),
);
