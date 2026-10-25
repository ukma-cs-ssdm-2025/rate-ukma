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

/** Held by an offering parse for its whole run: a run that read an older
 *  catalog page could write after a newer one and undo its faculty renames. */
export const PARSE_LOCK = 3;

const decodeLocked = Schema.decodeUnknownEffect(
	Schema.Tuple([Schema.Struct({ locked: Schema.Boolean })]),
);

/** Takes the session advisory lock `key` for the scope; `false` when another
 *  session holds it, unless `wait` is set, which waits for it instead. */
export const sessionLock = (key: number, wait = false) =>
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

		const take = wait
			? sql`SELECT true AS locked FROM pg_advisory_lock(${key})`
			: sql`SELECT pg_try_advisory_lock(${key}) AS locked`;

		const [{ locked }] = yield* take.pipe(
			onSession,
			Effect.flatMap(decodeLocked),
		);

		if (locked) {
			yield* Effect.addFinalizer(() =>
				sql`SELECT pg_advisory_unlock(${key})`.pipe(onSession, Effect.ignore),
			);
		}

		return locked;
	}).pipe(Effect.orDie);
