import { Context, Effect, Layer, Option, Schema } from "effect";
import { SqlClient, SqlSchema } from "effect/sql";
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

const ParseId = Schema.Struct({ id: Schema.BigInt });

/** What started a parse: a crawl that stored pages, or the `reparse`
 *  command. */
export type ParseTrigger = "crawl" | "reparse";

/** A course page that did not parse; its rows stay as they were. */
export interface ParseFailure {
	readonly snapshotId: bigint;
	readonly path: string;
	readonly reason: string;
}

/** Failed pages are counted by reason; `parse_failures` lists each one. */
export interface ParseReport {
	readonly seconds: number;
	readonly parsed: number;
	readonly failed: ReadonlyArray<{
		readonly reason: string;
		readonly pages: number;
	}>;
}

export class OfferingStore extends Context.Service<
	OfferingStore,
	{
		/** The id of the latest snapshot of each course page, in id order. */
		latestCoursePages: Effect.Effect<ReadonlyArray<bigint>>;
		coursePages(
			ids: ReadonlyArray<bigint>,
		): Effect.Effect<ReadonlyArray<StoredPage>>;
		/** Any catalog page carries the filters, so the latest one is enough. */
		latestCatalogPage: Effect.Effect<string | undefined>;
		/** Upserts the rows by their САЗ code, filter id or name, so ids stay,
		 *  and replaces the terms and programmes of each offering in the batch. A
		 *  filter id the catalog page did not list keeps its stored value. */
		write(rows: OfferingRows): Effect.Effect<void>;
		startParse(trigger: ParseTrigger): Effect.Effect<bigint>;
		recordFailures(
			parseId: bigint,
			failures: ReadonlyArray<ParseFailure>,
		): Effect.Effect<void>;
		finishParse(parseId: bigint, report: ParseReport): Effect.Effect<void>;
	}
>()("ukma-data/offerings/OfferingStore") {
	static readonly layer = Layer.effect(
		OfferingStore,
		Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;

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

			const json = (rows: ReadonlyArray<object>) => JSON.stringify(rows);

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

			const write = (rows: OfferingRows) =>
				Effect.gen(function* () {
					const codes = json(
						rows.offerings.map(({ sazCode }) => ({ sazCode })),
					);

					const faculties = planUnits(
						yield* findUnits("faculties"),
						rows.faculties,
					);

					yield* sql`
						UPDATE faculties t SET name = r.name, saz_filter_id = r."sazFilterId"
						FROM jsonb_to_recordset(${json(faculties.updates)}::jsonb)
							AS r(id text, name text, "sazFilterId" text)
						WHERE t.id = r.id
					`;

					yield* sql`
						INSERT INTO faculties (name, saz_filter_id)
						SELECT name, "sazFilterId"
						FROM jsonb_to_recordset(${json(faculties.inserts)}::jsonb)
							AS r(name text, "sazFilterId" text)
					`;

					const departments = planUnits(
						yield* findUnits("departments"),
						rows.departments,
					);

					yield* sql`
						UPDATE departments t
						SET name = r.name, saz_filter_id = r."sazFilterId",
							faculty_id = coalesce(f.id, t.faculty_id)
						FROM jsonb_to_recordset(${json(departments.updates)}::jsonb)
							AS r(id text, name text, faculty text, "sazFilterId" text)
						LEFT JOIN faculties f ON f.name = r.faculty
						WHERE t.id = r.id
					`;

					yield* sql`
						INSERT INTO departments (name, saz_filter_id, faculty_id)
						SELECT r.name, r."sazFilterId", f.id
						FROM jsonb_to_recordset(${json(departments.inserts)}::jsonb)
							AS r(name text, faculty text, "sazFilterId" text)
						LEFT JOIN faculties f ON f.name = r.faculty
					`;

					yield* sql`
						INSERT INTO programmes (name, level, saz_filter_id)
						SELECT name, level, "sazFilterId"
						FROM jsonb_to_recordset(${json(rows.programmes)}::jsonb)
							AS r(name text, level text, "sazFilterId" text)
						ON CONFLICT (name, level) DO UPDATE
						SET saz_filter_id = coalesce(EXCLUDED.saz_filter_id, programmes.saz_filter_id)
					`;

					yield* sql`
						INSERT INTO terms (code, academic_year, season)
						SELECT code, "academicYear", season
						FROM jsonb_to_recordset(${json(rows.terms)}::jsonb)
							AS r(code text, "academicYear" smallint, season text)
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
						FROM jsonb_to_recordset(${json(rows.offerings)}::jsonb) AS r(
							"sazCode" text, "academicYear" smallint, title text, faculty text,
							department text, level text, format text, credits numeric,
							hours integer, "studyYear" smallint, status text, "isPractical" boolean,
							annotation text, "sazTeachers" text, "maxStudents" integer,
							"maxGroups" integer, "computedMaxStudents" integer,
							"groupSizeMin" integer, "groupSizeMax" integer,
							"enrolledActive" integer, "snapshotId" bigint
						)
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
					`;

					const batchOfferings = sql`
						SELECT o.id FROM offerings o
						JOIN jsonb_to_recordset(${codes}::jsonb) AS r("sazCode" text)
							ON o.saz_code = r."sazCode"
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
						FROM jsonb_to_recordset(${json(rows.offeringTerms)}::jsonb) AS r(
							"sazCode" text, "termCode" text, semesters smallint[], credits numeric,
							"hoursPerWeek" integer, "lectureHours" integer, "seminarHours" integer,
							"practiceHours" integer, control text
						)
						JOIN offerings o ON o.saz_code = r."sazCode"
						JOIN terms t ON t.code = r."termCode"
					`;

					yield* sql`
						INSERT INTO offering_programmes (offering_id, programme_id, kind)
						SELECT o.id, p.id, r.kind
						FROM jsonb_to_recordset(${json(rows.offeringProgrammes)}::jsonb)
							AS r("sazCode" text, name text, level text, kind text)
						JOIN offerings o ON o.saz_code = r."sazCode"
						JOIN programmes p ON p.name = r.name AND p.level = r.level
					`;
				}).pipe(sql.withTransaction, Effect.orDie);

			const insertParse = SqlSchema.findOne({
				Request: Schema.String,
				Result: ParseId,
				execute: (trigger) =>
					sql`INSERT INTO parses (trigger) VALUES (${trigger}) RETURNING id`,
			});

			const startParse = (trigger: ParseTrigger) =>
				insertParse(trigger).pipe(
					Effect.map(({ id }) => id),
					Effect.orDie,
				);

			const recordFailures = (
				parseId: bigint,
				failures: ReadonlyArray<ParseFailure>,
			) =>
				failures.length === 0
					? Effect.void
					: sql`
							INSERT INTO parse_failures ${sql.insert(
								failures.map(({ snapshotId, path, reason }) => ({
									parse_id: parseId,
									snapshot_id: snapshotId,
									path,
									reason,
								})),
							)}
						`.pipe(Effect.asVoid, Effect.orDie);

			const finishParse = (parseId: bigint, report: ParseReport) =>
				sql`
					UPDATE parses SET finished_at = now(), report = ${JSON.stringify(report)}::jsonb
					WHERE id = ${parseId}
				`.pipe(Effect.asVoid, Effect.orDie);

			return OfferingStore.of({
				latestCoursePages,
				coursePages,
				latestCatalogPage,
				write,
				startParse,
				recordFailures,
				finishParse,
			});
		}),
	);
}
