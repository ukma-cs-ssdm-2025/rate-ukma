import { Effect, Schema } from "effect";
import { SqlClient } from "effect/sql";

/** Postgres advisory lock keys. Keys are shared by everything that connects
 *  to the database, so each one is declared here and nowhere else. */

/** Held by the crawl for its whole run: two crawls would reset each other's
 *  claimed pages. */
export const CRAWL_LOCK = 1;

/** The writers' turn (`ChangeLog.withTurn`), held by every write of numbered
 *  rows until it commits: numbers then commit in order, and two writers never
 *  plan the same inserts. The `require_turn` trigger checks for it. */
export const TURN_LOCK = 2;

const decodeLocked = Schema.decodeUnknownEffect(
	Schema.Tuple([Schema.Struct({ locked: Schema.Boolean })]),
);

/** Takes the session advisory lock `key` for the scope; `false` when another
 *  session holds it. */
export const sessionLock = (key: number) =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		const connection = yield* sql.reserve;

		// The lock belongs to the session and a pooled query may run on any
		// session, so lock and unlock share one reserved connection, provided as
		// the transaction connection.
		const onSession = Effect.provideService(sql.transactionService, [
			connection,
			0,
		] as const);

		const [{ locked }] = yield* sql`
			SELECT pg_try_advisory_lock(${key}) AS locked
		`.pipe(onSession, Effect.flatMap(decodeLocked));

		if (locked) {
			yield* Effect.addFinalizer(() =>
				sql`SELECT pg_advisory_unlock(${key})`.pipe(onSession, Effect.ignore),
			);
		}

		return locked;
	}).pipe(Effect.orDie);
