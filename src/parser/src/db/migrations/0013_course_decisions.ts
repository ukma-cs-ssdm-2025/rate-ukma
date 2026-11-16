import { Effect } from "effect";
import { SqlClient } from "effect/sql";

export default Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;

	yield* sql`ALTER TABLE audit_log DROP CONSTRAINT audit_log_action_check`;
	yield* sql`
		ALTER TABLE audit_log ADD CONSTRAINT audit_log_action_check
			CHECK (action IN (
				'request', 'request_denied', 'key_created', 'key_revoked',
				'course_merged', 'course_unmerged'
			))
	`;

	// The second id an action names: the course a merge moved into.
	yield* sql`ALTER TABLE audit_log ADD COLUMN related_id text`;

	// The course a staff merge moved the offering from, so an unmerge takes
	// back exactly those offerings, renamed ones too.
	yield* sql`ALTER TABLE offerings ADD COLUMN merged_from text REFERENCES courses (id)`;
});
