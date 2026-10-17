import { assert, describe, layer } from "@effect/vitest";
import { Cause, Deferred, Effect, Exit, Fiber, Layer, Schedule } from "effect";
import { SqlClient } from "effect/sql";
import { TURN_LOCK } from "../db/locks.ts";
import { TestDatabase, testDatabaseUrl } from "../db/testDatabase.ts";
import { ChangeLog } from "./ChangeLog.ts";

const TestLive = ChangeLog.layer.pipe(
	Layer.provideMerge(TestDatabase(testDatabaseUrl ?? "")),
);

const insertTerms = (codes: ReadonlyArray<string>) =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;

		return sql`
			INSERT INTO terms (code, academic_year, season, change_no)
			SELECT code, 2031, 'FALL', nextval('change_no_seq')
			FROM jsonb_array_elements_text(${JSON.stringify(codes)}::jsonb) AS code
			RETURNING id, change_no, 'add' AS action
		`;
	});

const numbersOf = (codes: ReadonlyArray<string>) =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;

		const rows = yield* sql<{ readonly changeNo: bigint }>`
			SELECT change_no AS "changeNo" FROM terms
			WHERE code IN ${sql.in(codes)}
			ORDER BY change_no
		`;

		return rows.map(({ changeNo }) => changeNo);
	});

/** Waits until a session holds the turn's lock, or until one waits for it. */
const turnLock = (granted: boolean) =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;

		return yield* sql<{ readonly locks: bigint }>`
			SELECT count(*) AS locks FROM pg_locks
			WHERE locktype = 'advisory' AND objid = ${TURN_LOCK} AND granted = ${granted}
		`.pipe(
			Effect.map(([row]) => row?.locks ?? 0n),
			Effect.repeat({
				until: (locks) => locks > 0n,
				schedule: Schedule.spaced("10 millis"),
			}),
		);
	});

describe.skipIf(testDatabaseUrl === undefined)("ChangeLog", () => {
	layer(TestLive, { timeout: 30_000, excludeTestServices: true })((it) => {
		it.effect(
			"numbers two concurrent writers in commit order, with no gap",
			() =>
				Effect.gen(function* () {
					const sql = yield* SqlClient.SqlClient;
					const changes = yield* ChangeLog;
					const release = yield* Deferred.make<void>();
					const first = ["T-A1", "T-A2", "T-A3"];
					const second = ["T-B1", "T-B2", "T-B3"];

					const write = (codes: ReadonlyArray<string>) =>
						insertTerms(codes).pipe(
							Effect.flatMap((statement) =>
								changes.track("terms", {}, statement),
							),
						);

					// The first writer holds its turn until released; the second
					// starts inside it and has to wait.
					const slow = yield* Effect.forkChild(
						changes.withTurn(
							write(first).pipe(Effect.andThen(Deferred.await(release))),
						),
					);

					yield* turnLock(true);

					const fast = yield* Effect.forkChild(changes.withTurn(write(second)));

					yield* turnLock(false);
					assert.deepStrictEqual(yield* numbersOf([...first, ...second]), []);

					yield* Deferred.succeed(release, undefined);
					yield* Fiber.join(slow);
					yield* Fiber.join(fast);

					const all = [
						...(yield* numbersOf(first)),
						...(yield* numbersOf(second)),
					];

					const start = all[0] ?? 0n;

					assert.deepStrictEqual(
						all,
						all.map((_, index) => start + BigInt(index)),
					);

					const trail = yield* sql<{ readonly rows: bigint }>`
						SELECT count(*) AS rows FROM changes
						WHERE table_name = 'terms' AND change_no IN ${sql.in(all)}
					`;

					assert.strictEqual(trail[0]?.rows, 6n);

					// A turn that rolls back leaves a hole below every later number.
					const rolledBack = yield* changes
						.withTurn(
							write(["T-C1"]).pipe(Effect.andThen(Effect.fail("rolled back"))),
						)
						.pipe(Effect.exit);

					yield* changes.withTurn(write(["T-C2"]));

					assert.isTrue(Exit.isFailure(rolledBack));
					assert.deepStrictEqual(yield* numbersOf(["T-C1"]), []);
					assert.isAbove(
						Number((yield* numbersOf(["T-C2"]))[0]),
						Number(all.at(-1)) + 1,
					);
				}),
		);

		it.effect("fails a change number taken outside the turn", () =>
			Effect.gen(function* () {
				const sql = yield* SqlClient.SqlClient;
				const changes = yield* ChangeLog;
				const outside = yield* (yield* insertTerms(["T-D1"])).pipe(Effect.flip);

				const nested = yield* changes
					.withTurn(Effect.void)
					.pipe(sql.withTransaction, Effect.exit);

				assert.include(
					Cause.pretty(Cause.fail(outside)),
					"change_no written outside the writers' turn",
				);
				assert.isTrue(Exit.hasDies(nested));
				assert.deepStrictEqual(yield* numbersOf(["T-D1"]), []);
			}),
		);
	});
});
