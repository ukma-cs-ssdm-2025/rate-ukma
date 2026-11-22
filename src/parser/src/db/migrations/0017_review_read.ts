import { Effect } from "effect";
import { SqlClient } from "effect/sql";

/** The `review:read` scope that serves review cases without letting the key
 *  decide them. */
export default Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;

	yield* sql`ALTER TABLE api_keys DROP CONSTRAINT api_keys_scopes_check`;
	yield* sql`
		ALTER TABLE api_keys ADD CONSTRAINT api_keys_scopes_check CHECK (
			cardinality(scopes) > 0
			AND scopes <@ ARRAY['catalog:read', 'review:read', 'review:decide', 'instructors:read']
		)
	`;
});
