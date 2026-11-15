import { Effect } from "effect";
import { SqlClient } from "effect/sql";

export default Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;

	yield* sql`
		CREATE TABLE courses (
			id text PRIMARY KEY DEFAULT 'crs_' || uuidv7(),
			title text NOT NULL,
			department_id text REFERENCES departments (id),
			level text NOT NULL CHECK (level IN ('bachelor', 'master')),
			merged_into text REFERENCES courses (id),
			change_no bigint NOT NULL UNIQUE,
			removed_at timestamptz
		)
	`;

	// The course rule looks a course up by its key. Not unique: a split
	// decision (rule 10) leaves two courses with one key.
	yield* sql`CREATE INDEX courses_key ON courses (title, department_id, level)`;

	yield* sql`
		CREATE TRIGGER courses_require_turn
		BEFORE INSERT OR UPDATE OF change_no ON courses
		FOR EACH STATEMENT EXECUTE FUNCTION require_turn()
	`;

	yield* sql`
		ALTER TABLE offerings
			ADD COLUMN course_id text REFERENCES courses (id),
			ADD COLUMN course_source text CHECK (course_source IN ('rule', 'decision'))
	`;
	yield* sql`CREATE INDEX offerings_course_id ON offerings (course_id)`;
});
