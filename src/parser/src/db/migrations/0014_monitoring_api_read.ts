import { Effect } from "effect";
import { SqlClient } from "effect/sql";

/**
 * Lets pg_monitor count API requests per key and route, for the queries in
 * infra/deploy/parser/k8s/platform/database/queries.yaml. Of api_keys it reads
 * the id and name only, never the secret hash or the scopes.
 */
export default Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;

	yield* sql`GRANT SELECT ON audit_log TO pg_monitor`;
	yield* sql`GRANT SELECT (id, name) ON api_keys TO pg_monitor`;
});
