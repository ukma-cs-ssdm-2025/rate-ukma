import { Effect } from "effect";
import { SqlClient } from "effect/sql";

/** smart.ukma teachers linked to САЗ offerings by the matching rule, and the
 *  `instructors:read` scope that serves them. A link is a child row of its
 *  offering: a change to an offering's teachers gives the offering a new
 *  change number. */
export default Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;

	yield* sql`
		CREATE TABLE offering_instructors (
			offering_id text NOT NULL REFERENCES offerings (id),
			instructor_id text NOT NULL REFERENCES instructors (id),
			role text NOT NULL CHECK (
				role IN ('LECTURER', 'PRACTICE_TEACHER', 'LECTURER_AND_PRACTICE_TEACHER')
			),
			PRIMARY KEY (offering_id, instructor_id)
		)
	`;
	yield* sql`
		CREATE INDEX offering_instructors_instructor_id
		ON offering_instructors (instructor_id)
	`;

	yield* sql`ALTER TABLE api_keys DROP CONSTRAINT api_keys_scopes_check`;
	yield* sql`
		ALTER TABLE api_keys ADD CONSTRAINT api_keys_scopes_check CHECK (
			cardinality(scopes) > 0
			AND scopes <@ ARRAY['catalog:read', 'review:decide', 'instructors:read']
		)
	`;
});
