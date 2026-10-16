import { Effect } from "effect";
import { SqlClient } from "effect/sql";

export default Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;

	// A ULID from the clock and 80 random bits of two UUIDs, skipping the
	// version and variant bits.
	yield* sql`
		CREATE FUNCTION ulid() RETURNS text LANGUAGE plpgsql VOLATILE AS $$
		DECLARE
			alphabet constant text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
			ms bigint := floor(extract(epoch FROM clock_timestamp()) * 1000);
			random bytea := substring(uuid_send(gen_random_uuid()) FROM 1 FOR 6)
				|| substring(uuid_send(gen_random_uuid()) FROM 11 FOR 4);
			bits bit(130) := B'00' || ms::bit(48) || ('x' || encode(random, 'hex'))::bit(80);
			result text := '';
		BEGIN
			FOR i IN 0..25 LOOP
				result := result || substr(alphabet, substring(bits FROM i * 5 + 1 FOR 5)::int + 1, 1);
			END LOOP;
			RETURN result;
		END
		$$
	`;

	yield* sql`
		CREATE TABLE terms (
			id text PRIMARY KEY DEFAULT 'trm_' || ulid(),
			code text NOT NULL UNIQUE,
			academic_year smallint NOT NULL,
			season text NOT NULL CHECK (season IN ('FALL', 'SPRING', 'SUMMER'))
		)
	`;

	// A batch moves names and filter ids between rows (a rename, an id that
	// follows its name), so uniqueness is checked at commit, not per row.
	yield* sql`
		CREATE TABLE faculties (
			id text PRIMARY KEY DEFAULT 'fac_' || ulid(),
			name text NOT NULL,
			saz_filter_id text,
			CONSTRAINT faculties_name_key UNIQUE (name) DEFERRABLE INITIALLY DEFERRED,
			CONSTRAINT faculties_saz_filter_id_key UNIQUE (saz_filter_id)
				DEFERRABLE INITIALLY DEFERRED
		)
	`;

	yield* sql`
		CREATE TABLE departments (
			id text PRIMARY KEY DEFAULT 'dep_' || ulid(),
			name text NOT NULL,
			saz_filter_id text,
			faculty_id text REFERENCES faculties (id),
			CONSTRAINT departments_name_key UNIQUE (name) DEFERRABLE INITIALLY DEFERRED,
			CONSTRAINT departments_saz_filter_id_key UNIQUE (saz_filter_id)
				DEFERRABLE INITIALLY DEFERRED
		)
	`;

	yield* sql`
		CREATE TABLE programmes (
			id text PRIMARY KEY DEFAULT 'prg_' || ulid(),
			name text NOT NULL,
			level text CHECK (level IN ('bachelor', 'master')),
			saz_filter_id text,
			UNIQUE NULLS NOT DISTINCT (name, level)
		)
	`;

	yield* sql`
		CREATE TABLE offerings (
			id text PRIMARY KEY DEFAULT 'off_' || ulid(),
			saz_code text NOT NULL UNIQUE,
			academic_year smallint NOT NULL,
			title text NOT NULL,
			faculty_id text REFERENCES faculties (id),
			department_id text REFERENCES departments (id),
			level text NOT NULL CHECK (level IN ('bachelor', 'master')),
			format text NOT NULL,
			credits numeric(4, 1) NOT NULL,
			hours integer NOT NULL,
			study_year smallint NOT NULL,
			status text NOT NULL CHECK (status IN ('held', 'not_held', 'may_hold', 'unknown')),
			is_practical boolean NOT NULL,
			annotation text,
			saz_teachers text,
			max_students integer,
			max_groups integer,
			computed_max_students integer,
			group_size_min integer NOT NULL,
			group_size_max integer NOT NULL,
			enrolled_active integer,
			snapshot_id bigint NOT NULL REFERENCES page_snapshots (id)
		)
	`;

	yield* sql`
		CREATE TABLE offering_terms (
			offering_id text NOT NULL REFERENCES offerings (id),
			term_id text NOT NULL REFERENCES terms (id),
			semesters smallint[] NOT NULL,
			credits numeric(4, 1) NOT NULL,
			hours_per_week integer,
			lecture_hours integer,
			seminar_hours integer,
			practice_hours integer,
			control text CHECK (control IN ('pass_fail', 'exam', 'thesis', 'none', 'thesis_defence')),
			PRIMARY KEY (offering_id, term_id)
		)
	`;

	yield* sql`
		CREATE TABLE offering_programmes (
			offering_id text NOT NULL REFERENCES offerings (id),
			programme_id text NOT NULL REFERENCES programmes (id),
			kind text NOT NULL CHECK (kind IN ('compulsory', 'prof_oriented', 'elective')),
			PRIMARY KEY (offering_id, programme_id)
		)
	`;

	yield* sql`CREATE INDEX departments_faculty_id ON departments (faculty_id)`;
	yield* sql`CREATE INDEX offerings_faculty_id ON offerings (faculty_id)`;
	yield* sql`CREATE INDEX offerings_department_id ON offerings (department_id)`;
	yield* sql`CREATE INDEX offerings_snapshot_id ON offerings (snapshot_id)`;
	yield* sql`CREATE INDEX offering_terms_term_id ON offering_terms (term_id)`;
	yield* sql`
		CREATE INDEX offering_programmes_programme_id ON offering_programmes (programme_id)
	`;
});
