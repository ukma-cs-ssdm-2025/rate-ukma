import { Context, Effect, Layer, Option, Schema, type Scope } from "effect";
import { SqlClient, SqlSchema } from "effect/sql";
import { PARSE_LOCK, sessionLock, WRITE_LOCK } from "../db/locks.ts";
import type {
	OfferingTerm,
	ParsedOffering,
	Season,
} from "../saz/coursePage.ts";
import { planUnits } from "./units.ts";

type Level = ParsedOffering["level"];

/** The rows one batch of course pages gives, keyed by names and codes; the
 *  store resolves them to ids. */
export interface OfferingRows {
	readonly faculties: ReadonlyArray<{
		readonly name: string;
		readonly sazFilterId: string | null;
	}>;
	readonly departments: ReadonlyArray<{
		readonly name: string;
		readonly faculty: string | null;
		readonly sazFilterId: string | null;
	}>;
	readonly programmes: ReadonlyArray<{
		readonly name: string;
		readonly level: Level;
		readonly sazFilterId: string | null;
	}>;
	readonly terms: ReadonlyArray<{
		readonly code: string;
		readonly academicYear: number;
		readonly season: Season;
	}>;
	readonly offerings: ReadonlyArray<
		Omit<ParsedOffering, "terms" | "programmes"> & {
			readonly snapshotId: string;
		}
	>;
	readonly offeringTerms: ReadonlyArray<
		Omit<OfferingTerm, "season"> & {
			readonly sazCode: string;
			readonly termCode: string;
		}
	>;
	readonly offeringProgrammes: ReadonlyArray<{
		readonly sazCode: string;
		readonly name: string;
		readonly level: Level;
		readonly kind: ParsedOffering["programmes"][number]["kind"];
	}>;
}

const StoredPage = Schema.Struct({
	id: Schema.BigInt,
	path: Schema.String,
	content: Schema.String,
});

export type StoredPage = typeof StoredPage.Type;

const SnapshotId = Schema.Struct({ id: Schema.BigInt });

export interface StoredProgramme {
	readonly name: string;
	readonly level: Level;
}

export class OfferingStore extends Context.Service<
	OfferingStore,
	{
		/** Waits for the parse lock and holds it for the scope. */
		lockParse: Effect.Effect<void, never, Scope.Scope>;
		/** The id of the latest snapshot of each course page, in id order. */
		latestCoursePages: Effect.Effect<ReadonlyArray<bigint>>;
		coursePages(
			ids: ReadonlyArray<bigint>,
		): Effect.Effect<ReadonlyArray<StoredPage>>;
		/** Any catalog page carries the filters, so the latest one is enough. */
		latestCatalogPage: Effect.Effect<string | undefined>;
		/** Every stored programme, for the level of one the catalog does not list. */
		programmes: Effect.Effect<ReadonlyArray<StoredProgramme>>;
		/** Upserts the rows by their САЗ code, name or filter id, so ids stay,
		 *  and replaces the terms and programmes of each offering in the batch. A
		 *  programme filter id the catalog page did not list keeps its stored
		 *  value. An offering already parsed from a newer snapshot keeps its
		 *  rows, so a parse that overlaps a crawl cannot roll it back. */
		write(rows: OfferingRows): Effect.Effect<void>;
	}
>()("ukma-data/offerings/OfferingStore") {
	static readonly layer = Layer.effect(
		OfferingStore,
		Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;

			const lockParse = sessionLock(PARSE_LOCK, true).pipe(
				Effect.asVoid,
				Effect.provideService(SqlClient.SqlClient, sql),
			);

			const findLatestCoursePages = SqlSchema.findAll({
				Request: Schema.Void,
				Result: SnapshotId,
				execute: () => sql`
					SELECT id FROM (
						SELECT DISTINCT ON (path) id FROM page_snapshots
						WHERE kind = 'course'
						ORDER BY path, id DESC
					) latest
					ORDER BY id
				`,
			});

			const latestCoursePages = findLatestCoursePages().pipe(
				Effect.map((rows) => rows.map(({ id }) => id)),
				Effect.orDie,
			);

			const findPages = SqlSchema.findAll({
				Request: Schema.Array(Schema.BigInt),
				Result: StoredPage,
				execute: (ids) => sql`
					SELECT id, path, content FROM page_snapshots
					WHERE id IN ${sql.in(ids)}
					ORDER BY id
				`,
			});

			const coursePages = (ids: ReadonlyArray<bigint>) =>
				findPages(ids).pipe(Effect.orDie);

			const findLatestCatalogPage = SqlSchema.findOneOption({
				Request: Schema.Void,
				Result: Schema.Struct({ content: Schema.String }),
				execute: () => sql`
					SELECT content FROM page_snapshots
					WHERE kind = 'catalog'
					ORDER BY id DESC
					LIMIT 1
				`,
			});

			const latestCatalogPage = findLatestCatalogPage().pipe(
				Effect.map(Option.map(({ content }) => content)),
				Effect.map(Option.getOrUndefined),
				Effect.orDie,
			);

			/** Rows sent as one `jsonb` value. `columns` names every key of the
			 *  row with its Postgres type, so the compiler keeps the two in step:
			 *  a key missing from the record set would read as null. */
			const recordset = <T extends object>(
				rows: ReadonlyArray<T>,
				columns: { readonly [K in keyof T]-?: string },
			) =>
				sql`jsonb_to_recordset(${JSON.stringify(rows)}::jsonb) AS r(${sql.unsafe(
					Object.entries(columns)
						.map(([key, type]) => `"${key}" ${type}`)
						.join(", "),
				)})`;

			const findUnits = SqlSchema.findAll({
				Request: Schema.Literals(["faculties", "departments"]),
				Result: Schema.Struct({
					id: Schema.String,
					name: Schema.String,
					sazFilterId: Schema.NullOr(Schema.String),
				}),
				execute: (table) =>
					sql`SELECT id, name, saz_filter_id AS "sazFilterId" FROM ${sql(table)}`,
			});

			const release = (
				table: "faculties" | "departments",
				ids: ReadonlyArray<string>,
			) =>
				ids.length === 0
					? Effect.void
					: sql`
							UPDATE ${sql(table)} SET saz_filter_id = NULL
							WHERE id IN ${sql.in(ids)}
						`.pipe(Effect.asVoid);

			const findProgrammes = SqlSchema.findAll({
				Request: Schema.Void,
				Result: Schema.Struct({
					name: Schema.String,
					level: Schema.Literals(["bachelor", "master"]),
				}),
				execute: () => sql`SELECT name, level FROM programmes`,
			});

			const programmes = findProgrammes().pipe(Effect.orDie);

			const write = (rows: OfferingRows) =>
				Effect.gen(function* () {
					yield* sql`SELECT pg_advisory_xact_lock(${WRITE_LOCK})`;

					const faculties = planUnits(
						yield* findUnits("faculties"),
						rows.faculties,
					);

					yield* release("faculties", faculties.released);

					yield* sql`
						UPDATE faculties t SET name = r.name, saz_filter_id = r."sazFilterId"
						FROM ${recordset(faculties.updates, { id: "text", name: "text", sazFilterId: "text" })}
						WHERE t.id = r.id
					`;

					yield* sql`
						INSERT INTO faculties (name, saz_filter_id)
						SELECT name, "sazFilterId"
						FROM ${recordset(faculties.inserts, { name: "text", sazFilterId: "text" })}
					`;

					const departments = planUnits(
						yield* findUnits("departments"),
						rows.departments,
					);

					yield* release("departments", departments.released);

					yield* sql`
						UPDATE departments t
						SET name = r.name, saz_filter_id = r."sazFilterId",
							faculty_id = coalesce(f.id, t.faculty_id)
						FROM ${recordset(departments.updates, { id: "text", name: "text", faculty: "text", sazFilterId: "text" })}
						LEFT JOIN faculties f ON f.name = r.faculty
						WHERE t.id = r.id
					`;

					yield* sql`
						INSERT INTO departments (name, saz_filter_id, faculty_id)
						SELECT r.name, r."sazFilterId", f.id
						FROM ${recordset(departments.inserts, { name: "text", faculty: "text", sazFilterId: "text" })}
						LEFT JOIN faculties f ON f.name = r.faculty
					`;

					yield* sql`
						INSERT INTO programmes (name, level, saz_filter_id)
						SELECT name, level, "sazFilterId"
						FROM ${recordset(rows.programmes, { name: "text", level: "text", sazFilterId: "text" })}
						ON CONFLICT (name, level) DO UPDATE
						SET saz_filter_id = coalesce(EXCLUDED.saz_filter_id, programmes.saz_filter_id)
					`;

					yield* sql`
						INSERT INTO terms (code, academic_year, season)
						SELECT code, "academicYear", season
						FROM ${recordset(rows.terms, { code: "text", academicYear: "smallint", season: "text" })}
						ON CONFLICT (code) DO NOTHING
					`;

					yield* sql`
						INSERT INTO offerings (
							saz_code, academic_year, title, faculty_id, department_id, level,
							format, credits, hours, study_year, status, is_practical,
							annotation, saz_teachers, max_students, max_groups,
							computed_max_students, group_size_min, group_size_max,
							enrolled_active, snapshot_id
						)
						SELECT r."sazCode", r."academicYear", r.title, f.id, d.id, r.level,
							r.format, r.credits, r.hours, r."studyYear", r.status, r."isPractical",
							r.annotation, r."sazTeachers", r."maxStudents", r."maxGroups",
							r."computedMaxStudents", r."groupSizeMin", r."groupSizeMax",
							r."enrolledActive", r."snapshotId"
						FROM ${recordset(rows.offerings, {
							sazCode: "text",
							academicYear: "smallint",
							title: "text",
							faculty: "text",
							department: "text",
							level: "text",
							format: "text",
							credits: "numeric",
							hours: "integer",
							studyYear: "smallint",
							status: "text",
							isPractical: "boolean",
							annotation: "text",
							sazTeachers: "text",
							maxStudents: "integer",
							maxGroups: "integer",
							computedMaxStudents: "integer",
							groupSizeMin: "integer",
							groupSizeMax: "integer",
							enrolledActive: "integer",
							snapshotId: "bigint",
						})}
						LEFT JOIN faculties f ON f.name = r.faculty
						LEFT JOIN departments d ON d.name = r.department
						ON CONFLICT (saz_code) DO UPDATE SET
							academic_year = EXCLUDED.academic_year,
							title = EXCLUDED.title,
							faculty_id = EXCLUDED.faculty_id,
							department_id = EXCLUDED.department_id,
							level = EXCLUDED.level,
							format = EXCLUDED.format,
							credits = EXCLUDED.credits,
							hours = EXCLUDED.hours,
							study_year = EXCLUDED.study_year,
							status = EXCLUDED.status,
							is_practical = EXCLUDED.is_practical,
							annotation = EXCLUDED.annotation,
							saz_teachers = EXCLUDED.saz_teachers,
							max_students = EXCLUDED.max_students,
							max_groups = EXCLUDED.max_groups,
							computed_max_students = EXCLUDED.computed_max_students,
							group_size_min = EXCLUDED.group_size_min,
							group_size_max = EXCLUDED.group_size_max,
							enrolled_active = EXCLUDED.enrolled_active,
							snapshot_id = EXCLUDED.snapshot_id
						WHERE offerings.snapshot_id <= EXCLUDED.snapshot_id
					`;

					const batchOfferings = sql`
						SELECT o.id FROM offerings o
						JOIN ${recordset(
							rows.offerings.map(({ sazCode, snapshotId }) => ({
								sazCode,
								snapshotId,
							})),
							{ sazCode: "text", snapshotId: "bigint" },
						)} ON o.saz_code = r."sazCode" AND o.snapshot_id = r."snapshotId"
					`;

					yield* sql`DELETE FROM offering_terms WHERE offering_id IN (${batchOfferings})`;
					yield* sql`DELETE FROM offering_programmes WHERE offering_id IN (${batchOfferings})`;

					yield* sql`
						INSERT INTO offering_terms (
							offering_id, term_id, semesters, credits, hours_per_week,
							lecture_hours, seminar_hours, practice_hours, control
						)
						SELECT o.id, t.id, r.semesters, r.credits, r."hoursPerWeek",
							r."lectureHours", r."seminarHours", r."practiceHours", r.control
						FROM ${recordset(rows.offeringTerms, {
							sazCode: "text",
							termCode: "text",
							semesters: "smallint[]",
							credits: "numeric",
							hoursPerWeek: "integer",
							lectureHours: "integer",
							seminarHours: "integer",
							practiceHours: "integer",
							control: "text",
						})}
						JOIN offerings o ON o.saz_code = r."sazCode"
							AND o.id IN (${batchOfferings})
						JOIN terms t ON t.code = r."termCode"
					`;

					yield* sql`
						INSERT INTO offering_programmes (offering_id, programme_id, kind)
						SELECT o.id, p.id, r.kind
						FROM ${recordset(rows.offeringProgrammes, { sazCode: "text", name: "text", level: "text", kind: "text" })}
						JOIN offerings o ON o.saz_code = r."sazCode"
							AND o.id IN (${batchOfferings})
						JOIN programmes p ON p.name = r.name AND p.level = r.level
					`;
				}).pipe(sql.withTransaction, Effect.orDie);

			return OfferingStore.of({
				lockParse,
				latestCoursePages,
				coursePages,
				latestCatalogPage,
				programmes,
				write,
			});
		}),
	);
}
