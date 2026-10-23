import { Effect } from "effect";
import { SqlClient } from "effect/sql";

export default Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;

	// The only personal fields, email and full name, live here. `snapshot_id`
	// is the list that last set the name, so an older list cannot set it back.
	yield* sql`
		CREATE TABLE students (
			id text PRIMARY KEY DEFAULT 'stu_' || ulid(),
			email text UNIQUE CHECK (email = lower(email)),
			full_name text NOT NULL,
			snapshot_id bigint NOT NULL REFERENCES page_snapshots (id),
			change_no bigint NOT NULL UNIQUE,
			removed_at timestamptz
		)
	`;

	yield* sql`
		CREATE TABLE student_programmes (
			id text PRIMARY KEY DEFAULT 'spr_' || ulid(),
			saz_cdoc text NOT NULL UNIQUE,
			student_id text NOT NULL REFERENCES students (id),
			spec_name text NOT NULL,
			programme_id text REFERENCES programmes (id),
			snapshot_id bigint NOT NULL REFERENCES page_snapshots (id),
			change_no bigint NOT NULL UNIQUE,
			removed_at timestamptz
		)
	`;

	yield* sql`
		CREATE TABLE enrollments (
			id text PRIMARY KEY DEFAULT 'enr_' || ulid(),
			offering_id text NOT NULL REFERENCES offerings (id),
			student_programme_id text NOT NULL REFERENCES student_programmes (id),
			kind text NOT NULL CHECK (kind IN ('compulsory', 'prof_oriented', 'elective')),
			status text NOT NULL CHECK (status IN ('enrolled', 'unenrolled')),
			is_student_active boolean NOT NULL,
			is_forced boolean NOT NULL,
			group_no smallint,
			grade smallint NOT NULL,
			saz_created_at timestamptz,
			saz_updated_at timestamptz,
			change_no bigint NOT NULL UNIQUE,
			removed_at timestamptz,
			UNIQUE (offering_id, student_programme_id)
		)
	`;

	// A loaded list, empty or not, with the page it came from. An offering
	// without a row has never had its list loaded.
	yield* sql`
		CREATE TABLE enrollment_lists (
			offering_id text PRIMARY KEY REFERENCES offerings (id),
			snapshot_id bigint NOT NULL REFERENCES page_snapshots (id),
			entry_count integer NOT NULL,
			parsed_at timestamptz NOT NULL DEFAULT now()
		)
	`;

	for (const table of ["students", "student_programmes", "enrollments"]) {
		yield* sql`
			CREATE TRIGGER ${sql(`${table}_require_turn`)}
			BEFORE INSERT OR UPDATE OF change_no ON ${sql(table)}
			FOR EACH STATEMENT EXECUTE FUNCTION require_turn()
		`;
	}

	yield* sql`CREATE INDEX student_programmes_student_id ON student_programmes (student_id)`;
	yield* sql`
		CREATE INDEX student_programmes_programme_id ON student_programmes (programme_id)
	`;
	yield* sql`
		CREATE INDEX enrollments_student_programme_id ON enrollments (student_programme_id)
	`;
});
