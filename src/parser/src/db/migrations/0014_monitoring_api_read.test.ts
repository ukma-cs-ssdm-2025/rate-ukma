import { assert, describe, layer } from "@effect/vitest";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { TestDatabase, testDatabaseUrl } from "../testing.ts";

layer(TestDatabase(testDatabaseUrl))((it) => {
	describe("0014_monitoring_api_read", () => {
		it.effect(
			"lets pg_monitor read the audit log and key names but not the secrets",
			() =>
				Effect.gen(function* () {
					const sql = yield* SqlClient.SqlClient;

					const rows = yield* sql<{
						readonly target: string;
						readonly canSelect: boolean;
					}>`
					SELECT 'audit_log' AS target,
						has_table_privilege('pg_monitor', 'audit_log', 'SELECT') AS "canSelect"
					UNION ALL
					SELECT 'api_keys.' || c,
						has_column_privilege('pg_monitor', 'api_keys', c, 'SELECT')
					FROM unnest(ARRAY['id', 'name', 'secret_hash', 'scopes']) AS c
				`;

					assert.deepStrictEqual(
						Object.fromEntries(rows.map((row) => [row.target, row.canSelect])),
						{
							audit_log: true,
							"api_keys.id": true,
							"api_keys.name": true,
							"api_keys.secret_hash": false,
							"api_keys.scopes": false,
						},
					);
				}),
		);
	});
});
