import { Context, Effect, Layer, Option, Schema } from "effect";
import { SqlClient, SqlSchema, type Statement } from "effect/sql";
import {
	type ChangeCount,
	ChangeLog,
	countChanges,
	mergeChangeCounts,
	type NumberedTable,
} from "../changes/ChangeLog.ts";
import { recordsetOf } from "../db/recordset.ts";
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
			readonly rowHash: string;
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

export const ParseTrigger = Schema.Literals(["crawl", "reparse"]);

export type ParseTrigger = typeof ParseTrigger.Type;

/** A course page that did not parse; its rows stay as they were. */
export interface ParseFailure {
	readonly snapshotId: bigint;
	readonly path: string;
	readonly reason: string;
}

/** Failed pages are counted by reason; `parse_failures` lists each one.
 *  `changes` counts the rows that took a change number. */
export interface ParseReport {
	readonly seconds: number;
	readonly parsed: number;
	readonly failed: ReadonlyArray<{
		readonly reason: string;
		readonly pages: number;
	}>;
	readonly changes: ReadonlyArray<ChangeCount>;
}

export interface StoredProgramme {
	readonly name: string;
	readonly level: Level;
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
		/** Every stored programme, for the level of one the catalog does not list. */
		programmes: Effect.Effect<ReadonlyArray<StoredProgramme>>;
		/** Upserts the rows by their САЗ code, name or filter id, so ids stay,
		 *  in one writers' turn. A row takes a change number and a `changes` row
		 *  only when its content changed, and only then are an offering's terms
		 *  and programmes replaced. A programme filter id the catalog page did
		 *  not list keeps its stored value. An offering already parsed from a
		 *  newer snapshot keeps its rows, so a parse that overlaps a crawl cannot
		 *  roll it back. Returns the rows numbered, by table and action. */
		write(
			rows: OfferingRows,
			parseId: bigint,
		): Effect.Effect<ReadonlyArray<ChangeCount>>;
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
			const changes = yield* ChangeLog;

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

			const recordset = recordsetOf(sql);

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

			const findProgrammes = SqlSchema.findAll({
				Request: Schema.Void,
				Result: Schema.Struct({
					name: Schema.String,
					level: Schema.Literals(["bachelor", "master"]),
				}),
				execute: () => sql`SELECT name, level FROM programmes`,
			});

			const programmes = findProgrammes().pipe(Effect.orDie);

			const offeringColumns = {
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
				rowHash: "text",
			} as const;

			/** Every statement numbers only the rows it really changes, so a
			 *  parse of unchanged pages takes no number. */
			const write = (rows: OfferingRows, parseId: bigint) =>
				changes
					.withTurn(
						Effect.gen(function* () {
							const written: Array<ReadonlyArray<ChangeCount>> = [];

							const track = (
								table: NumberedTable,
								statement: Statement.Fragment,
							) =>
								changes
									.track(table, { parseId }, statement)
									.pipe(
										Effect.tap((rows) =>
											Effect.sync(() =>
												written.push(countChanges(table, rows)),
											),
										),
									);

							const release = (
								table: "faculties" | "departments",
								ids: ReadonlyArray<string>,
							) =>
								track(
									table,
									sql`
										UPDATE ${sql(table)}
										SET saz_filter_id = NULL, change_no = nextval('change_no_seq')
										WHERE id IN ${sql.in(ids)}
										RETURNING id, change_no, 'change' AS action
									`,
								).pipe(Effect.when(Effect.succeed(ids.length > 0)));

							const faculties = planUnits(
								yield* findUnits("faculties"),
								rows.faculties,
							);

							yield* release("faculties", faculties.released);

							yield* track(
								"faculties",
								sql`
									UPDATE faculties t
									SET name = r.name, saz_filter_id = r."sazFilterId",
										change_no = nextval('change_no_seq')
									FROM ${recordset(faculties.updates, { id: "text", name: "text", sazFilterId: "text" })}
									WHERE t.id = r.id
										AND (t.name, t.saz_filter_id) IS DISTINCT FROM (r.name, r."sazFilterId")
									RETURNING t.id, t.change_no, 'change' AS action
								`,
							);

							yield* track(
								"faculties",
								sql`
									INSERT INTO faculties (name, saz_filter_id, change_no)
									SELECT name, "sazFilterId", nextval('change_no_seq')
									FROM ${recordset(faculties.inserts, { name: "text", sazFilterId: "text" })}
									RETURNING id, change_no, 'add' AS action
								`,
							);

							const departments = planUnits(
								yield* findUnits("departments"),
								rows.departments,
							);

							yield* release("departments", departments.released);

							// A department keeps the faculty it was first stored with: cards
							// of different years can name different faculties, and following
							// each batch would renumber it on every parse.
							yield* track(
								"departments",
								sql`
									UPDATE departments t
									SET name = r.name, saz_filter_id = r."sazFilterId",
										faculty_id = coalesce(t.faculty_id, f.id),
										change_no = nextval('change_no_seq')
									FROM ${recordset(departments.updates, { id: "text", name: "text", faculty: "text", sazFilterId: "text" })}
									LEFT JOIN faculties f ON f.name = r.faculty
									WHERE t.id = r.id
										AND (t.name, t.saz_filter_id, t.faculty_id) IS DISTINCT FROM
											(r.name, r."sazFilterId", coalesce(t.faculty_id, f.id))
									RETURNING t.id, t.change_no, 'change' AS action
								`,
							);

							yield* track(
								"departments",
								sql`
									INSERT INTO departments (name, saz_filter_id, faculty_id, change_no)
									SELECT r.name, r."sazFilterId", f.id, nextval('change_no_seq')
									FROM ${recordset(departments.inserts, { name: "text", faculty: "text", sazFilterId: "text" })}
									LEFT JOIN faculties f ON f.name = r.faculty
									RETURNING id, change_no, 'add' AS action
								`,
							);

							const programmes = recordset(rows.programmes, {
								name: "text",
								level: "text",
								sazFilterId: "text",
							});

							yield* track(
								"programmes",
								sql`
									UPDATE programmes p
									SET saz_filter_id = r."sazFilterId", change_no = nextval('change_no_seq')
									FROM ${programmes}
									WHERE p.name = r.name AND p.level = r.level
										AND r."sazFilterId" IS NOT NULL
										AND p.saz_filter_id IS DISTINCT FROM r."sazFilterId"
									RETURNING p.id, p.change_no, 'change' AS action
								`,
							);

							yield* track(
								"programmes",
								sql`
									INSERT INTO programmes (name, level, saz_filter_id, change_no)
									SELECT r.name, r.level, r."sazFilterId", nextval('change_no_seq')
									FROM ${programmes}
									WHERE NOT EXISTS (
										SELECT 1 FROM programmes p
										WHERE p.name = r.name AND p.level = r.level
									)
									RETURNING id, change_no, 'add' AS action
								`,
							);

							yield* track(
								"terms",
								sql`
									INSERT INTO terms (code, academic_year, season, change_no)
									SELECT code, "academicYear", season, nextval('change_no_seq')
									FROM ${recordset(rows.terms, { code: "text", academicYear: "smallint", season: "text" })}
									WHERE NOT EXISTS (SELECT 1 FROM terms t WHERE t.code = r.code)
									RETURNING id, change_no, 'add' AS action
								`,
							);

							const offerings = sql`
								${recordset(rows.offerings, offeringColumns)}
								LEFT JOIN faculties f ON f.name = r.faculty
								LEFT JOIN departments d ON d.name = r.department
							`;

							const added = yield* track(
								"offerings",
								sql`
									INSERT INTO offerings (
										saz_code, academic_year, title, faculty_id, department_id, level,
										format, credits, hours, study_year, status, is_practical,
										annotation, saz_teachers, max_students, max_groups,
										computed_max_students, group_size_min, group_size_max,
										enrolled_active, snapshot_id, row_hash, change_no
									)
									SELECT r."sazCode", r."academicYear", r.title, f.id, d.id, r.level,
										r.format, r.credits, r.hours, r."studyYear", r.status, r."isPractical",
										r.annotation, r."sazTeachers", r."maxStudents", r."maxGroups",
										r."computedMaxStudents", r."groupSizeMin", r."groupSizeMax",
										r."enrolledActive", r."snapshotId", r."rowHash", nextval('change_no_seq')
									FROM ${offerings}
									WHERE NOT EXISTS (SELECT 1 FROM offerings o WHERE o.saz_code = r."sazCode")
									RETURNING id, change_no, 'add' AS action
								`,
							);

							// A live row changes when its hash does, or when its faculty or
							// department now resolves to another row. A removed row comes back
							// only when a run fetched its page after the removal: its last
							// snapshot stays the latest of its path, so every parse sees it.
							// An offering already parsed from a newer snapshot keeps its rows.
							const updated = yield* track(
								"offerings",
								sql`
									UPDATE offerings o SET
										academic_year = r."academicYear", title = r.title,
										faculty_id = f.id, department_id = d.id, level = r.level,
										format = r.format, credits = r.credits, hours = r.hours,
										study_year = r."studyYear", status = r.status,
										is_practical = r."isPractical", annotation = r.annotation,
										saz_teachers = r."sazTeachers", max_students = r."maxStudents",
										max_groups = r."maxGroups",
										computed_max_students = r."computedMaxStudents",
										group_size_min = r."groupSizeMin",
										group_size_max = r."groupSizeMax",
										enrolled_active = r."enrolledActive",
										snapshot_id = r."snapshotId", row_hash = r."rowHash",
										removed_at = NULL, change_no = nextval('change_no_seq')
									FROM offerings prev, ${offerings}
									WHERE prev.id = o.id AND o.saz_code = r."sazCode"
										AND o.snapshot_id <= r."snapshotId"
										AND CASE WHEN o.removed_at IS NULL
											THEN o.row_hash IS DISTINCT FROM r."rowHash"
												OR (o.faculty_id, o.department_id) IS DISTINCT FROM (f.id, d.id)
											ELSE EXISTS (
												SELECT 1 FROM run_pages p
												WHERE p.path = '/course/' || o.saz_code AND p.status = 'done'
													AND p.finished_at > o.removed_at
											)
										END
									RETURNING o.id, o.change_no,
										CASE WHEN prev.removed_at IS NULL THEN 'change' ELSE 'restore' END
											AS action
								`,
							);

							yield* sql`
								UPDATE offerings o SET snapshot_id = r."snapshotId"
								FROM ${recordset(
									rows.offerings.map(({ sazCode, snapshotId, rowHash }) => ({
										sazCode,
										snapshotId,
										rowHash,
									})),
									{ sazCode: "text", snapshotId: "bigint", rowHash: "text" },
								)}
								WHERE o.saz_code = r."sazCode" AND o.removed_at IS NULL
									AND o.row_hash = r."rowHash" AND o.snapshot_id < r."snapshotId"
							`;

							const rewritten = [...added, ...updated].map(
								({ rowId }) => rowId,
							);

							if (rewritten.length > 0) {
								yield* sql`DELETE FROM offering_terms WHERE offering_id IN ${sql.in(rewritten)}`;
								yield* sql`DELETE FROM offering_programmes WHERE offering_id IN ${sql.in(rewritten)}`;

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
										AND o.id IN ${sql.in(rewritten)}
									JOIN terms t ON t.code = r."termCode"
								`;

								yield* sql`
									INSERT INTO offering_programmes (offering_id, programme_id, kind)
									SELECT o.id, p.id, r.kind
									FROM ${recordset(rows.offeringProgrammes, { sazCode: "text", name: "text", level: "text", kind: "text" })}
									JOIN offerings o ON o.saz_code = r."sazCode"
										AND o.id IN ${sql.in(rewritten)}
									JOIN programmes p ON p.name = r.name AND p.level = r.level
								`;
							}

							return mergeChangeCounts(written.flat());
						}),
					)
					.pipe(Effect.orDie);

			const insertParse = SqlSchema.findOne({
				Request: ParseTrigger,
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
				programmes,
				write,
				startParse,
				recordFailures,
				finishParse,
			});
		}),
	);
}
