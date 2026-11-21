import { Effect } from "effect";
import { SqlClient } from "effect/sql";

/** smart.ukma teachers and disciplines, parsed from the stored lists. A
 *  discipline's teachers are child rows: a change to them gives the
 *  discipline a new change number. */
export default Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;

	yield* sql`
		CREATE TABLE instructors (
			id text PRIMARY KEY DEFAULT 'ins_' || uuidv7(),
			smart_id integer NOT NULL UNIQUE,
			last_name text NOT NULL,
			first_name text NOT NULL,
			middle_name text,
			email text,
			smart_department_id integer,
			department_name text,
			row_hash text NOT NULL,
			snapshot_id bigint NOT NULL REFERENCES page_snapshots (id),
			change_no bigint NOT NULL UNIQUE,
			removed_at timestamptz
		)
	`;

	yield* sql`
		CREATE TABLE smart_disciplines (
			id text PRIMARY KEY DEFAULT 'dis_' || uuidv7(),
			smart_id integer NOT NULL UNIQUE,
			title text NOT NULL,
			smart_department_id integer,
			department_name text,
			credits numeric(5, 1) NOT NULL,
			semester smallint NOT NULL CHECK (semester BETWEEN 1 AND 12),
			entrance_year smallint,
			academic_year smallint,
			season text CHECK (season IN ('FALL', 'SPRING', 'SUMMER')),
			level text CHECK (level IN ('bachelor', 'master')),
			row_hash text NOT NULL,
			snapshot_id bigint NOT NULL REFERENCES page_snapshots (id),
			change_no bigint NOT NULL UNIQUE,
			removed_at timestamptz
		)
	`;

	// A link may name a teacher missing from the teacher list, so it keeps
	// smart.ukma's teacher id rather than a foreign key.
	yield* sql`
		CREATE TABLE smart_discipline_instructors (
			discipline_id text NOT NULL REFERENCES smart_disciplines (id),
			instructor_smart_id integer NOT NULL,
			role text NOT NULL CHECK (
				role IN ('LECTURER', 'PRACTICE_TEACHER', 'LECTURER_AND_PRACTICE_TEACHER')
			),
			PRIMARY KEY (discipline_id, instructor_smart_id, role)
		)
	`;

	for (const table of ["instructors", "smart_disciplines"]) {
		yield* sql`
			CREATE TRIGGER ${sql(`${table}_require_turn`)}
			BEFORE INSERT OR UPDATE OF change_no ON ${sql(table)}
			FOR EACH STATEMENT EXECUTE FUNCTION require_turn()
		`;
	}
});
