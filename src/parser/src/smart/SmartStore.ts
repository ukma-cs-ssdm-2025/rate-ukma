import { Context, Effect, Layer, Option, Schema } from "effect";
import { SqlClient, SqlSchema } from "effect/sql";
import { ChangeLog, type ChangeSource } from "../changes/ChangeLog.ts";
import { recordsetOf } from "../db/recordset.ts";
import type { DisciplineRow, InstructorRow, SmartLists } from "./catalog.ts";

/** The newest stored copy of each smart.ukma list. */
export interface StoredLists {
	readonly lists: SmartLists;
	readonly teachersSnapshotId: bigint;
	readonly disciplinesSnapshotId: bigint;
}

export interface SmartWritten {
	readonly instructors: number;
	readonly disciplines: number;
}

const Latest = Schema.Struct({
	kind: Schema.String,
	id: Schema.BigInt,
	length: Schema.Int,
});

/** Characters read per query. The disciplines list passes 24 MB, over the
 *  16 MB a pg client message may carry, and a character takes at most 4
 *  bytes, so one part stays under 8 MB. */
const PART = 2_000_000;

export class SmartStore extends Context.Service<
	SmartStore,
	{
		/** None until every list has been stored once. */
		latest(): Effect.Effect<Option.Option<StoredLists>>;
		/** Upserts teachers and disciplines in one writers' turn; only a row
		 *  whose hash changed, or that comes back, takes a number, and rows gone from a list that
		 *  is not empty are removed. Returns how many rows took a number. */
		write(
			instructors: ReadonlyArray<InstructorRow>,
			disciplines: ReadonlyArray<DisciplineRow>,
			stored: StoredLists,
			source: ChangeSource,
		): Effect.Effect<SmartWritten>;
	}
>()("ukma-data/smart/SmartStore") {
	static readonly layer = Layer.effect(
		SmartStore,
		Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			const changes = yield* ChangeLog;
			const recordset = recordsetOf(sql);

			const findLatest = SqlSchema.findAll({
				Request: Schema.Void,
				Result: Latest,
				execute: () => sql`
					SELECT DISTINCT ON (kind) kind, id, length(content) AS length
					FROM page_snapshots
					WHERE kind IN (
						'smart_departments', 'smart_teachers', 'smart_disciplines',
						'smart_teacher_disciplines'
					)
					ORDER BY kind, id DESC
				`,
			});

			const findPart = SqlSchema.findOne({
				Request: Schema.Struct({ id: Schema.BigInt, from: Schema.Int }),
				Result: Schema.Struct({ part: Schema.String }),
				execute: ({ id, from }) => sql`
					SELECT substr(content, ${from}, ${PART}) AS part
					FROM page_snapshots WHERE id = ${id}
				`,
			});

			const contentOf = ({ id, length }: typeof Latest.Type) =>
				Effect.forEach(
					Array.from({ length: Math.ceil(length / PART) }, (_, i) => i),
					(i) => findPart({ id, from: i * PART + 1 }),
				).pipe(Effect.map((parts) => parts.map(({ part }) => part).join("")));

			const latest = () =>
				Effect.gen(function* () {
					const byKind = new Map(
						(yield* findLatest()).map((row) => [row.kind, row]),
					);

					const departments = byKind.get("smart_departments");
					const teachers = byKind.get("smart_teachers");
					const disciplines = byKind.get("smart_disciplines");
					const links = byKind.get("smart_teacher_disciplines");

					if (
						departments === undefined ||
						teachers === undefined ||
						disciplines === undefined ||
						links === undefined
					) {
						return Option.none();
					}

					return Option.some({
						lists: {
							departments: yield* contentOf(departments),
							teachers: yield* contentOf(teachers),
							disciplines: yield* contentOf(disciplines),
							links: yield* contentOf(links),
						},
						teachersSnapshotId: teachers.id,
						disciplinesSnapshotId: disciplines.id,
					});
				}).pipe(Effect.orDie);

			const action = sql`CASE
				WHEN old.id IS NULL THEN 'add'
				WHEN old.removed_at IS NOT NULL THEN 'restore'
				ELSE 'change'
			END`;

			const write = (
				instructors: ReadonlyArray<InstructorRow>,
				disciplines: ReadonlyArray<DisciplineRow>,
				stored: StoredLists,
				source: ChangeSource,
			) =>
				changes.withTurn(
					Effect.gen(function* () {
						const teachers = yield* changes.track(
							"instructors",
							source,
							sql`
								INSERT INTO instructors AS i (
									smart_id, last_name, first_name, middle_name, email,
									smart_department_id, department_name, row_hash, snapshot_id,
									change_no
								)
								SELECT r."smartId", r."lastName", r."firstName", r."middleName",
									r.email, r."smartDepartmentId", r."departmentName", r."rowHash",
									${stored.teachersSnapshotId}, nextval('change_no_seq')
								FROM ${recordset(instructors, {
									smartId: "integer",
									lastName: "text",
									firstName: "text",
									middleName: "text",
									email: "text",
									smartDepartmentId: "integer",
									departmentName: "text",
									rowHash: "text",
								})}
								LEFT JOIN instructors was ON was.smart_id = r."smartId"
								WHERE was.row_hash IS DISTINCT FROM r."rowHash"
									OR was.removed_at IS NOT NULL
								ON CONFLICT (smart_id) DO UPDATE SET
									last_name = excluded.last_name,
									first_name = excluded.first_name,
									middle_name = excluded.middle_name,
									email = excluded.email,
									smart_department_id = excluded.smart_department_id,
									department_name = excluded.department_name,
									row_hash = excluded.row_hash,
									snapshot_id = excluded.snapshot_id,
									change_no = excluded.change_no,
									removed_at = NULL
								RETURNING i.id, i.change_no, ${action} AS action
							`,
						);

						const courses = yield* changes.track(
							"smart_disciplines",
							source,
							sql`
								INSERT INTO smart_disciplines AS d (
									smart_id, title, smart_department_id, department_name,
									credits, semester, entrance_year, academic_year, season,
									level, row_hash, snapshot_id, change_no
								)
								SELECT r."smartId", r.title, r."smartDepartmentId",
									r."departmentName", r.credits, r.semester, r."entranceYear",
									r."academicYear", r.season, r.level, r."rowHash",
									${stored.disciplinesSnapshotId},
									nextval('change_no_seq')
								FROM ${recordset(disciplines, {
									smartId: "integer",
									title: "text",
									smartDepartmentId: "integer",
									departmentName: "text",
									credits: "numeric",
									semester: "smallint",
									entranceYear: "smallint",
									academicYear: "smallint",
									season: "text",
									level: "text",
									teachers: "jsonb",
									rowHash: "text",
								})}
								LEFT JOIN smart_disciplines was ON was.smart_id = r."smartId"
								WHERE was.row_hash IS DISTINCT FROM r."rowHash"
									OR was.removed_at IS NOT NULL
								ON CONFLICT (smart_id) DO UPDATE SET
									title = excluded.title,
									smart_department_id = excluded.smart_department_id,
									department_name = excluded.department_name,
									credits = excluded.credits,
									semester = excluded.semester,
									entrance_year = excluded.entrance_year,
									academic_year = excluded.academic_year,
									season = excluded.season,
									level = excluded.level,
									row_hash = excluded.row_hash,
									snapshot_id = excluded.snapshot_id,
									change_no = excluded.change_no,
									removed_at = NULL
								RETURNING d.id, d.change_no, ${action} AS action
							`,
						);

						const changed = courses.map(({ rowId }) => rowId);

						if (changed.length > 0) {
							yield* sql`
								DELETE FROM smart_discipline_instructors
								WHERE discipline_id IN ${sql.in(changed)}
							`;
							yield* sql`
								INSERT INTO smart_discipline_instructors (
									discipline_id, instructor_smart_id, role
								)
								SELECT d.id, t."smartId", t.role
								FROM ${recordset(
									disciplines.flatMap(({ smartId, teachers }) =>
										teachers.map((teacher) => ({
											disciplineSmartId: smartId,
											smartId: teacher.smartId,
											role: teacher.role,
										})),
									),
									{
										disciplineSmartId: "integer",
										smartId: "integer",
										role: "text",
									},
									"t",
								)}
								JOIN smart_disciplines d ON d.smart_id = t."disciplineSmartId"
								WHERE d.id IN ${sql.in(changed)}
							`;
						}

						// An empty list is more likely a broken reply than a university
						// with no teachers, so it removes nothing.
						const removed = (
							table: "instructors" | "smart_disciplines",
							ids: ReadonlyArray<number>,
						) =>
							ids.length === 0
								? Effect.succeed([])
								: changes.track(
										table,
										source,
										sql`
											UPDATE ${sql(table)}
											SET removed_at = now(), change_no = nextval('change_no_seq')
											WHERE removed_at IS NULL AND smart_id NOT IN ${sql.in(ids)}
											RETURNING id, change_no, 'remove' AS action
										`,
									);

						const gone = yield* removed(
							"instructors",
							instructors.map(({ smartId }) => smartId),
						);

						const dropped = yield* removed(
							"smart_disciplines",
							disciplines.map(({ smartId }) => smartId),
						);

						return {
							instructors: teachers.length + gone.length,
							disciplines: courses.length + dropped.length,
						};
					}),
				);

			return SmartStore.of({ latest, write });
		}),
	);
}
