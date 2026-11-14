import { assert, describe, layer } from "@effect/vitest";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { TestDatabase, testDatabaseUrl } from "../testing.ts";

layer(TestDatabase(testDatabaseUrl))((it) => {
	describe("0010_monitoring_read", () => {
		it.effect(
			"lets pg_monitor read the crawl tables but not the snapshots",
			() =>
				Effect.gen(function* () {
					const sql = yield* SqlClient.SqlClient;

					const rows = yield* sql<{
						readonly tableName: string;
						readonly canSelect: boolean;
					}>`
					SELECT t AS "tableName", has_table_privilege('pg_monitor', t, 'SELECT') AS "canSelect"
					FROM unnest(ARRAY['runs', 'run_pages', 'page_snapshots']) AS t
				`;

					assert.deepStrictEqual(
						Object.fromEntries(
							rows.map((row) => [row.tableName, row.canSelect]),
						),
						{ runs: true, run_pages: true, page_snapshots: false },
					);
				}),
		);
	});
});
