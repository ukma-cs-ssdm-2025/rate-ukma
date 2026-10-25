import { Context, Effect, Layer, Option, Schema } from "effect";
import { SqlClient, type SqlError, type Statement } from "effect/sql";
import { TURN_LOCK } from "../db/locks.ts";

/** Present only inside `ChangeLog.withTurn`. A write that numbers rows requires
 *  it, so a call outside a turn does not compile. */
export class Turn extends Context.Service<Turn, { readonly key: number }>()(
	"ukma-data/changes/Turn",
) {}

const ChangeAction = Schema.Literals(["add", "change"]);

export type ChangeAction = typeof ChangeAction.Type;

export type NumberedTable =
	| "terms"
	| "faculties"
	| "departments"
	| "programmes"
	| "offerings";

/** What made a change: the parse that wrote the rows. */
export interface ChangeSource {
	readonly parseId?: bigint;
}

const Written = Schema.Struct({ rowId: Schema.String, action: ChangeAction });

export type Written = typeof Written.Type;

/** Rows written, by table and action, for run and parse reports (rule 11). */
export interface ChangeCount {
	readonly table: NumberedTable;
	readonly action: ChangeAction;
	readonly rows: number;
}

export const countChanges = (
	table: NumberedTable,
	written: ReadonlyArray<Written>,
): ReadonlyArray<ChangeCount> => {
	const counts = new Map<ChangeAction, number>();

	for (const { action } of written) {
		counts.set(action, (counts.get(action) ?? 0) + 1);
	}

	return Array.from(counts, ([action, rows]) => ({ table, action, rows }));
};

/** Adds counts of the same table and action. */
export const mergeChangeCounts = (
	counts: ReadonlyArray<ChangeCount>,
): ReadonlyArray<ChangeCount> => {
	const merged = new Map<string, ChangeCount>();

	for (const count of counts) {
		const key = `${count.table} ${count.action}`;
		const rows = (merged.get(key)?.rows ?? 0) + count.rows;

		merged.set(key, { ...count, rows });
	}

	return [...merged.values()];
};

export class ChangeLog extends Context.Service<
	ChangeLog,
	{
		/** Runs the effect in a transaction that first takes the writers' turn.
		 *  The lock is released only after commit, so a writer takes its numbers
		 *  after every earlier writer's rows are visible, and a reader that sees
		 *  number n sees every row below it (spec rule 5). It dies inside an
		 *  open transaction, where the lock would come after numbers already
		 *  taken. */
		withTurn<A, E, R>(
			effect: Effect.Effect<A, E, R>,
		): Effect.Effect<A, E | SqlError.SqlError, Exclude<R, Turn>>;
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
				);

			const track = (
				table: NumberedTable,
				source: ChangeSource,
				write: Statement.Fragment,
			) =>
				sql`
					WITH written AS (${write})
					INSERT INTO changes (change_no, table_name, row_id, action, parse_id)
					SELECT change_no, ${table}, id, action, ${source.parseId ?? null}::bigint
					FROM written
					RETURNING row_id AS "rowId", action
				`.pipe(Effect.flatMap(decode), Effect.orDie);

			return ChangeLog.of({ withTurn, track });
		}),
	);
}
