import { assert, describe, layer } from "@effect/vitest";
import { Effect, Fiber, Layer } from "effect";
import { SqlClient } from "effect/sql";
import { TestDatabase, testDatabaseUrl } from "../db/testDatabase.ts";
import { ChangeLog } from "./ChangeLog.ts";

const TestLive = ChangeLog.layer.pipe(
	Layer.provideMerge(TestDatabase(testDatabaseUrl ?? "")),
);

describe.skipIf(testDatabaseUrl === undefined)("ChangeLog", () => {
	layer(TestLive, { timeout: 30_000 })((it) => {
		it.live(
			"numbers two concurrent writers in commit order, with no gap",
			() =>
				Effect.gen(function* () {
					const sql = yield* SqlClient.SqlClient;
					const changes = yield* ChangeLog;

					const addTerms = (codes: ReadonlyArray<string>, pause: number) =>
						changes.withTurn(
							Effect.gen(function* () {
								const written = yield* changes.track(
									"terms",
									{},
									sql`
										INSERT INTO terms (code, academic_year, season, change_no)
										SELECT code, 2031, 'FALL', nextval('change_no_seq')
										FROM jsonb_array_elements_text(${JSON.stringify(codes)}::jsonb) AS code
										RETURNING id, change_no, 'add' AS action
									`,
								);

								yield* sql`SELECT pg_sleep(${pause})`;

								return written;
							}),
						);

					const numbersOf = (codes: ReadonlyArray<string>) =>
						sql<{ readonly changeNo: bigint }>`
							SELECT change_no AS "changeNo" FROM terms
							WHERE code IN ${sql.in(codes)}
							ORDER BY change_no
						`.pipe(Effect.map((rows) => rows.map(({ changeNo }) => changeNo)));

					const first = ["T-A1", "T-A2", "T-A3"];
					const second = ["T-B1", "T-B2", "T-B3"];

					// The first writer holds its turn for 0.6 s; the second starts
					// inside it and has to wait.
					const slow = yield* Effect.forkChild(addTerms(first, 0.6));

					yield* Effect.sleep("150 millis");

					const fast = yield* Effect.forkChild(addTerms(second, 0));

					yield* Effect.sleep("150 millis");

					assert.deepStrictEqual(yield* numbersOf([...first, ...second]), []);

					yield* Fiber.join(slow);
					yield* Fiber.join(fast);

					const a = yield* numbersOf(first);
					const b = yield* numbersOf(second);
					const all = [...a, ...b];
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
				}),
		);
	});
});
