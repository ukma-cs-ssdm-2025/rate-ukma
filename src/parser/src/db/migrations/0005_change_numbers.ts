import { Effect } from "effect";
import { SqlClient } from "effect/sql";

const NUMBERED = [
	"terms",
	"faculties",
	"departments",
	"programmes",
	"offerings",
] as const;

export default Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;

	// A session cache would hand out ranges, and numbers would stop following
	// the commit order.
	yield* sql`CREATE SEQUENCE change_no_seq CACHE 1`;

	// The default numbers the stored rows once and is then dropped, so an
	// insert that does not take a number in turn fails.
	for (const table of NUMBERED) {
		yield* sql`
			ALTER TABLE ${sql(table)}
			ADD COLUMN change_no bigint NOT NULL DEFAULT nextval('change_no_seq')
		`;
		yield* sql`ALTER TABLE ${sql(table)} ALTER COLUMN change_no DROP DEFAULT`;
		yield* sql`CREATE UNIQUE INDEX ${sql(`${table}_change_no`)} ON ${sql(table)} (change_no)`;
	}

	for (const table of NUMBERED.slice(1)) {
		yield* sql`ALTER TABLE ${sql(table)} ADD COLUMN removed_at timestamptz`;
	}

	yield* sql`ALTER TABLE offerings ADD COLUMN row_hash text`;

	// The restore check of a removed offering looks up its page's latest fetch.
	yield* sql`
		CREATE INDEX run_pages_done_path ON run_pages (path, finished_at)
		WHERE status = 'done'
	`;

	yield* sql`
		ALTER TABLE runs ADD COLUMN offering_removals text
			CHECK (offering_removals IN ('applied', 'held', 'skipped'))
	`;

	yield* sql`
		CREATE TABLE review_cases (
			id text PRIMARY KEY DEFAULT 'rev_' || ulid(),
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
		CREATE TABLE changes (
			change_no bigint PRIMARY KEY,
			table_name text NOT NULL,
			row_id text NOT NULL,
			action text NOT NULL CHECK (action IN ('add', 'change', 'remove', 'restore')),
			run_id bigint REFERENCES runs (id),
			parse_id bigint REFERENCES parses (id),
			decision_id text,
			at timestamptz NOT NULL DEFAULT now()
		)
	`;
	yield* sql`CREATE INDEX changes_run ON changes (run_id) WHERE run_id IS NOT NULL`;
	yield* sql`CREATE INDEX changes_parse ON changes (parse_id) WHERE parse_id IS NOT NULL`;

	for (const table of NUMBERED) {
		yield* sql`
			INSERT INTO changes (change_no, table_name, row_id, action)
			SELECT change_no, ${table}, id, 'add' FROM ${sql(table)}
		`;
	}

	// Whatever code writes it, a change number taken outside the writers' turn
	// (ChangeLog.withTurn) fails the statement.
	yield* sql`
		CREATE FUNCTION require_turn() RETURNS trigger LANGUAGE plpgsql AS $$
		BEGIN
			IF NOT EXISTS (
				SELECT 1 FROM pg_locks
				WHERE locktype = 'advisory' AND classid = 0 AND objid = 7640001
					AND objsubid = 1 AND pid = pg_backend_pid() AND granted
			) THEN
				RAISE EXCEPTION 'change_no written outside the writers'' turn';
			END IF;

			RETURN NULL;
		END
		$$
	`;

	for (const table of [...NUMBERED, "review_cases"]) {
		yield* sql`
			CREATE TRIGGER ${sql(`${table}_require_turn`)}
			BEFORE INSERT OR UPDATE OF change_no ON ${sql(table)}
			FOR EACH STATEMENT EXECUTE FUNCTION require_turn()
		`;
	}
});
