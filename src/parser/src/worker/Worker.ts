import { Effect, Layer, Schedule } from "effect";
import { SqlClient } from "effect/sql";

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
	}),
);
