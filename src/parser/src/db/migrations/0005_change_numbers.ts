import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { TURN_LOCK } from "../locks.ts";

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

	yield* sql`ALTER TABLE offerings ADD COLUMN row_hash text`;

	yield* sql`
		CREATE TABLE changes (
			change_no bigint PRIMARY KEY,
			table_name text NOT NULL,
			row_id text NOT NULL,
			action text NOT NULL CHECK (action IN ('add', 'change')),
			parse_id bigint REFERENCES parses (id),
			decision_id text,
			at timestamptz NOT NULL DEFAULT now()
		)
	`;
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
				WHERE locktype = 'advisory' AND classid = 0
					AND objid = ${sql.literal(String(TURN_LOCK))}
					AND objsubid = 1 AND pid = pg_backend_pid() AND granted
			) THEN
				RAISE EXCEPTION 'change_no written outside the writers'' turn';
			END IF;

			RETURN NULL;
		END
		$$
	`;

	for (const table of NUMBERED) {
		yield* sql`
			CREATE TRIGGER ${sql(`${table}_require_turn`)}
			BEFORE INSERT OR UPDATE OF change_no ON ${sql(table)}
			FOR EACH STATEMENT EXECUTE FUNCTION require_turn()
		`;
	}
});
