import { Effect } from "effect";
import { SqlClient } from "effect/sql";

export default Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;

	for (const table of ["faculties", "departments", "programmes", "offerings"]) {
		yield* sql`ALTER TABLE ${sql(table)} ADD COLUMN removed_at timestamptz`;
	}

	yield* sql`
		ALTER TABLE runs ADD COLUMN offering_removals text
			CHECK (offering_removals IN ('applied', 'held', 'skipped'))
	`;

	yield* sql`
		CREATE TABLE review_cases (
			id text PRIMARY KEY DEFAULT 'rev_' || uuidv7(),
			kind text NOT NULL
				CHECK (kind IN ('course_match', 'instructor_match', 'removals_held')),
			subject_id text NOT NULL,
			candidates jsonb NOT NULL,
			safe_answer jsonb NOT NULL,
			status text NOT NULL DEFAULT 'open'
				CHECK (status IN ('open', 'decided', 'obsolete')),
			run_id bigint REFERENCES runs (id),
			decision_id text,
			opened_at timestamptz NOT NULL DEFAULT now(),
			change_no bigint NOT NULL UNIQUE
		)
	`;

	yield* sql`
		CREATE TRIGGER review_cases_require_turn
		BEFORE INSERT OR UPDATE OF change_no ON review_cases
		FOR EACH STATEMENT EXECUTE FUNCTION require_turn()
	`;

	yield* sql`ALTER TABLE changes ADD COLUMN run_id bigint REFERENCES runs (id)`;
	yield* sql`CREATE INDEX changes_run ON changes (run_id) WHERE run_id IS NOT NULL`;

	// The restore check of a removed offering finds the run that removed it,
	// then a later fetch of its page.
	yield* sql`CREATE INDEX changes_removed ON changes (row_id) WHERE action = 'remove'`;
	yield* sql`
		CREATE INDEX run_pages_done_path ON run_pages (path, run_id)
		WHERE status = 'done'
	`;

	yield* sql`ALTER TABLE changes DROP CONSTRAINT changes_action_check`;
	yield* sql`
		ALTER TABLE changes ADD CONSTRAINT changes_action_check
			CHECK (action IN ('add', 'change', 'remove', 'restore'))
	`;
});
