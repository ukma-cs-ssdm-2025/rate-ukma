import { Effect, Layer, Schedule } from "effect";
import { SqlClient } from "effect/sql";
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

		yield* crawlAllYears().pipe(
			Effect.andThen(parseOfferings()),
			Effect.catchCause((cause) => Effect.logError("Crawl failed", cause)),
			Effect.forkScoped,
		);
	}),
).pipe(Layer.provide([CrawlStore.layer, OfferingStore.layer, SazClient.layer]));
