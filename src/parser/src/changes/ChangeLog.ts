import { Context, Effect, Layer, Option, Schema } from "effect";
import { SqlClient, SqlError, SqlSchema, type Statement } from "effect/sql";
import { TURN_LOCK } from "../db/locks.ts";

/** Present only inside `ChangeLog.withTurn`. A write that numbers rows requires
 *  it, so a call outside a turn does not compile. */
export class Turn extends Context.Service<Turn, { readonly key: number }>()(
	"ukma-data/changes/Turn",
) {}

const ChangeAction = Schema.Literals(["add", "change", "remove", "restore"]);

export type ChangeAction = typeof ChangeAction.Type;

export type NumberedTable =
	| "terms"
	| "faculties"
	| "departments"
	| "programmes"
	| "offerings"
	| "courses"
	| "review_cases"
	| "students"
	| "student_programmes"
	| "enrollments"
	| "instructors"
	| "smart_disciplines";

/** What made a change: a parse writes rows, a run's removal step removes them. */
export interface ChangeSource {
	readonly parseId?: bigint;
	readonly runId?: bigint;
}

const Written = Schema.Struct({ rowId: Schema.String, action: ChangeAction });

export type Written = typeof Written.Type;

/** Rows numbered, by table and action, for run and parse reports (rule 11). */
export const ChangeCount = Schema.Struct({
	table: Schema.String,
	action: ChangeAction,
	rows: Schema.Number,
});

export type ChangeCount = typeof ChangeCount.Type;

/** Fails a rehearsal's transaction on purpose, so it rolls back. */
class RolledBack extends Schema.TaggedError<RolledBack>()("RolledBack", {}) {}

export class ChangeLog extends Context.Service<
	ChangeLog,
	{
		/** Runs the effect in a transaction that first takes the writers' turn.
		 *  The lock is released only after commit, so a writer takes its numbers
		 *  after every earlier writer's rows are visible, and a reader that sees
		 *  number n sees every row below it (spec rule 5). It dies inside an
		 *  open transaction, where the lock would come after numbers already
		 *  taken. No caller recovers from a SQL error, so it is a defect. */
		withTurn<A, E, R>(
			effect: Effect.Effect<A, E, R>,
		): Effect.Effect<A, Exclude<E, SqlError.SqlError>, Exclude<R, Turn>>;
		/** Runs the effect as `withTurn` would, then rolls it back: a dry run
		 *  of a write, with its result and the rows it numbered. Sequence
		 *  numbers it took stay used, a gap readers already allow. */
		rehearse<A, E, R>(
			effect: Effect.Effect<A, E, R>,
		): Effect.Effect<
			{ readonly result: A; readonly written: ReadonlyArray<ChangeCount> },
			Exclude<E, SqlError.SqlError>,
			Exclude<R, Turn>
		>;
		/** Runs a write that returns `id`, `change_no` and `action` of each row it
		 *  numbered, and adds the trail row of each to `changes`. */
		track(
			table: NumberedTable,
			source: ChangeSource,
			write: Statement.Fragment,
		): Effect.Effect<ReadonlyArray<Written>, never, Turn>;
	}
>()("ukma-data/changes/ChangeLog") {
	static readonly layer = Layer.effect(
		ChangeLog,
		Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			const decode = Schema.decodeUnknownEffect(Schema.Array(Written));

			const withTurn = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
				Effect.serviceOption(sql.transactionService).pipe(
					Effect.flatMap((open) =>
						Option.isSome(open)
							? Effect.die("ChangeLog.withTurn inside an open transaction")
							: sql`SELECT pg_advisory_xact_lock(${TURN_LOCK})`.pipe(
									Effect.andThen(effect),
									Effect.provideService(Turn, Turn.of({ key: TURN_LOCK })),
									sql.withTransaction,
								),
					),
					Effect.catchIf(SqlError.isSqlError, Effect.die),
				);

			const track = (
				table: NumberedTable,
				source: ChangeSource,
				write: Statement.Fragment,
			) =>
				sql`
					WITH written AS (${write})
					INSERT INTO changes (change_no, table_name, row_id, action, parse_id, run_id)
					SELECT change_no, ${table}, id, action,
						${source.parseId ?? null}::bigint, ${source.runId ?? null}::bigint
					FROM written
					RETURNING row_id AS "rowId", action
				`.pipe(Effect.flatMap(decode), Effect.orDie);

			const lastChange = SqlSchema.findOne({
				Request: Schema.Void,
				Result: Schema.Struct({ last: Schema.Number }),
				execute: () => sql`
					SELECT coalesce(max(change_no), 0)::float8 AS last FROM changes
				`,
			});

			const countSince = SqlSchema.findAll({
				Request: Schema.Number,
				Result: ChangeCount,
				execute: (last) => sql`
					SELECT table_name AS "table", action, count(*)::int AS rows
					FROM changes WHERE change_no > ${last}
					GROUP BY table_name, action ORDER BY table_name, action
				`,
			});

			const rehearse = <A, E, R>(effect: Effect.Effect<A, E, R>) => {
				let outcome:
					| { readonly result: A; readonly written: ReadonlyArray<ChangeCount> }
					| undefined;

				return withTurn(
					Effect.gen(function* () {
						// The turn keeps other writers out, so every change above
						// `last` is this effect's.
						const { last } = yield* lastChange().pipe(Effect.orDie);
						const result = yield* effect;
						const written = yield* countSince(last).pipe(Effect.orDie);

						outcome = { result, written };

						return yield* new RolledBack();
					}),
				).pipe(
					Effect.catchTag("RolledBack", () =>
						outcome === undefined
							? Effect.die("ChangeLog.rehearse rolled back without an outcome")
							: Effect.succeed(outcome),
					),
				);
			};

			return ChangeLog.of({ withTurn, rehearse, track });
		}),
	);
}
