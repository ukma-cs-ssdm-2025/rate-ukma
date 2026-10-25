import { Context, Effect, Layer, Schema } from "effect";
import { SqlClient, SqlSchema, type Statement } from "effect/sql";
import {
	type ChangeCount,
	ChangeLog,
	countChanges,
	mergeChangeCounts,
	type NumberedTable,
} from "../changes/ChangeLog.ts";
import { recordsetOf } from "../db/recordset.ts";
import type { ParseTrigger } from "../offerings/OfferingStore.ts";
import { type StudentList, studentRowsOf } from "./rows.ts";

const StudentsPage = Schema.Struct({
	id: Schema.BigInt,
	path: Schema.String,
	sazCode: Schema.String,
	content: Schema.String,
});

export type StudentsPage = typeof StudentsPage.Type;

/** What one batch of lists wrote: `parsed` lists, and the САЗ codes of the
 *  lists that had live enrollments and are now empty. */
export interface ListsWritten {
	readonly changes: ReadonlyArray<ChangeCount>;
	readonly parsed: number;
	readonly emptied: ReadonlyArray<string>;
}

export class StudentStore extends Context.Service<
	StudentStore,
	{
		/** The latest students page of each offering that exists (A3), in id
		 *  order. A crawl leaves out the lists already applied from that page. */
		latestStudentPages(
			trigger: ParseTrigger,
		): Effect.Effect<ReadonlyArray<bigint>>;
		pages(
			ids: ReadonlyArray<bigint>,
		): Effect.Effect<ReadonlyArray<StudentsPage>>;
		/** Replaces each offering's enrollments with its list, in one writers'
		 *  turn: listed rows are upserted, unlisted live rows removed, and only
		 *  rows whose content changed take a number. A person or programme
		 *  record with no live enrollment left is removed, and restored when
		 *  one returns. A list already applied from a newer page keeps its rows,
		 *  so a parse that overlaps a crawl cannot roll it back. */
		write(
			lists: ReadonlyArray<StudentList>,
			parseId: bigint,
		): Effect.Effect<ListsWritten>;
	}
>()("ukma-data/students/StudentStore") {
	static readonly layer = Layer.effect(
		StudentStore,
		Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			const changes = yield* ChangeLog;
			const recordset = recordsetOf(sql);

			const findLatest = SqlSchema.findAll({
				Request: Schema.Boolean,
				Result: Schema.Struct({ id: Schema.BigInt }),
				execute: (all) => sql`
					SELECT s.id FROM (
						SELECT DISTINCT ON (path) id, path FROM page_snapshots
						WHERE kind = 'students'
						ORDER BY path, id DESC
					) s
					JOIN offerings o ON o.saz_code = split_part(s.path, '/', 3)
					LEFT JOIN enrollment_lists l ON l.offering_id = o.id
					WHERE ${all} OR l.snapshot_id IS DISTINCT FROM s.id
					ORDER BY s.id
				`,
			});

			const latestStudentPages = (trigger: ParseTrigger) =>
				findLatest(trigger === "reparse").pipe(
					Effect.map((rows) => rows.map(({ id }) => id)),
					Effect.orDie,
				);

			const findPages = SqlSchema.findAll({
				Request: Schema.Array(Schema.BigInt),
				Result: StudentsPage,
				execute: (ids) => sql`
					SELECT id, path, split_part(path, '/', 3) AS "sazCode", content
					FROM page_snapshots
					WHERE id IN ${sql.in(ids)}
					ORDER BY id
				`,
			});

			const pages = (ids: ReadonlyArray<bigint>) =>
				findPages(ids).pipe(Effect.orDie);

			const findApplied = SqlSchema.findAll({
				Request: Schema.Array(Schema.String),
				Result: Schema.Struct({
					sazCode: Schema.String,
					snapshotId: Schema.BigInt,
				}),
				execute: (codes) => sql`
					SELECT o.saz_code AS "sazCode", l.snapshot_id AS "snapshotId"
					FROM enrollment_lists l JOIN offerings o ON o.id = l.offering_id
					WHERE o.saz_code IN ${sql.in(codes)}
				`,
			});

			const findProgrammes = SqlSchema.findAll({
				Request: Schema.Array(Schema.String),
				Result: Schema.Struct({
					cdoc: Schema.String,
					snapshotId: Schema.BigInt,
				}),
				execute: (cdocs) => sql`
					SELECT saz_cdoc AS cdoc, snapshot_id AS "snapshotId"
					FROM student_programmes WHERE saz_cdoc IN ${sql.in(cdocs)}
				`,
			});

			const decodeFresh = Schema.decodeUnknownEffect(
				Schema.Array(
					Schema.Struct({
						id: Schema.String,
						cdoc: Schema.NullOr(Schema.String),
						email: Schema.NullOr(Schema.String),
						fullName: Schema.String,
						snapshotId: Schema.String,
					}),
				),
			);

			const decodeCodes = Schema.decodeUnknownEffect(
				Schema.Array(Schema.Struct({ sazCode: Schema.String })),
			);

			/** `p` is a person row; a name with `*` keeps a stored one without. */
			const keptName = sql`
				CASE WHEN p."fullName" LIKE '%*%' AND s.full_name NOT LIKE '%*%'
					THEN s.full_name ELSE p."fullName" END
			`;

			const write = (lists: ReadonlyArray<StudentList>, parseId: bigint) =>
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

							const applied = new Map(
								(yield* findApplied(lists.map(({ sazCode }) => sazCode))).map(
									({ sazCode, snapshotId }) => [sazCode, snapshotId],
								),
							);

							const current = lists.filter(
								({ sazCode, snapshotId }) =>
									(applied.get(sazCode) ?? 0n) <= snapshotId,
							);

							if (current.length === 0) {
								return { changes: [], parsed: 0, emptied: [] };
							}

							const cdocs = [
								...new Set(
									current.flatMap(({ entries }) =>
										entries.map(({ cdoc }) => cdoc),
									),
								),
							];

							const stored =
								cdocs.length === 0 ? [] : yield* findProgrammes(cdocs);

							const rows = studentRowsOf(
								current,
								new Map(
									stored.map(({ cdoc, snapshotId }) => [cdoc, snapshotId]),
								),
							);

							// A person is found by email, else, for an entry without one, by
							// the student its `cdoc` already points to (D3).
							const persons = sql`(
								SELECT r.*, coalesce(
									(SELECT s.id FROM students s WHERE s.email = r.email),
									(SELECT sp.student_id FROM student_programmes sp
										WHERE r.email IS NULL AND sp.saz_cdoc = r.cdoc)
								) AS "studentId"
								FROM ${recordset(rows.students, { email: "text", cdoc: "text", fullName: "text", snapshotId: "bigint" })}
							) p`;

							// An entry without an email does not rename a student that has one.
							yield* track(
								"students",
								sql`
									UPDATE students s
									SET full_name = ${keptName}, snapshot_id = p."snapshotId",
										change_no = nextval('change_no_seq')
									FROM ${persons}
									WHERE s.id = p."studentId" AND s.snapshot_id <= p."snapshotId"
										AND (p.email IS NOT NULL OR s.email IS NULL)
										AND s.full_name IS DISTINCT FROM ${keptName}
									RETURNING s.id, s.change_no, 'change' AS action
								`,
							);

							yield* sql`
								UPDATE students s SET snapshot_id = p."snapshotId"
								FROM ${persons}
								WHERE s.id = p."studentId" AND s.snapshot_id < p."snapshotId"
							`;

							// A person without an email gets an id here, so its programme
							// record can point to it.
							const fresh = yield* sql`
								SELECT 'stu_' || uuidv7() AS id, p.cdoc, p.email, p."fullName",
									p."snapshotId"::text AS "snapshotId"
								FROM ${persons}
								WHERE p."studentId" IS NULL
							`.pipe(Effect.flatMap(decodeFresh));

							yield* track(
								"students",
								sql`
									INSERT INTO students (id, email, full_name, snapshot_id, change_no)
									SELECT id, email, "fullName", "snapshotId", nextval('change_no_seq')
									FROM ${recordset(fresh, { id: "text", cdoc: "text", email: "text", fullName: "text", snapshotId: "bigint" })}
									RETURNING id, change_no, 'add' AS action
								`,
							).pipe(Effect.when(Effect.succeed(fresh.length > 0)));

							const freshByCdoc = new Map(
								fresh.flatMap(({ id, cdoc }) =>
									cdoc === null ? [] : [[cdoc, id]],
								),
							);

							const programmes = sql`(
								SELECT r.*, coalesce(
									(SELECT s.id FROM students s WHERE s.email = r.email),
									r."freshId"
								) AS "ownerId", coalesce(
									(
										SELECT min(pr.id) FROM offering_programmes op
										JOIN programmes pr ON pr.id = op.programme_id
										WHERE pr.name = r."specName" AND op.offering_id IN (
											SELECT o.id FROM offerings o WHERE o.saz_code = ANY (r."sazCodes")
											UNION ALL
											SELECT e.offering_id FROM enrollments e
											JOIN student_programmes sp ON sp.id = e.student_programme_id
											JOIN offerings o ON o.id = e.offering_id
											WHERE sp.saz_cdoc = r.cdoc AND e.removed_at IS NULL
												AND o.saz_code NOT IN ${sql.in(current.map(({ sazCode }) => sazCode))}
										)
										HAVING count(DISTINCT pr.id) = 1
									),
									(
										SELECT min(pr.id) FROM programmes pr
										WHERE pr.name = r."specName" HAVING count(*) = 1
									)
								) AS "programmeId"
								FROM ${recordset(
									rows.programmes.map((programme) => ({
										...programme,
										freshId: freshByCdoc.get(programme.cdoc) ?? null,
									})),
									{
										cdoc: "text",
										email: "text",
										specName: "text",
										snapshotId: "bigint",
										sazCodes: "text[]",
										freshId: "text",
									},
								)}
							) q`;

							// The latest list moves a record to the student of its email (D1).
							// A list names the programme without its level (D12); the cards of
							// the record's offerings that list that name give it, with this
							// batch's lists in place of their stored enrollments. A record
							// whose cards name both levels links only a name of one level.
							yield* track(
								"student_programmes",
								sql`
									UPDATE student_programmes sp
									SET student_id = coalesce(q."ownerId", sp.student_id),
										spec_name = q."specName", programme_id = q."programmeId",
										snapshot_id = q."snapshotId", change_no = nextval('change_no_seq')
									FROM ${programmes}
									WHERE sp.saz_cdoc = q.cdoc
										AND (sp.student_id, sp.spec_name, sp.programme_id) IS DISTINCT FROM
											(coalesce(q."ownerId", sp.student_id), q."specName", q."programmeId")
									RETURNING sp.id, sp.change_no, 'change' AS action
								`,
							);

							yield* sql`
								UPDATE student_programmes sp SET snapshot_id = q."snapshotId"
								FROM ${programmes}
								WHERE sp.saz_cdoc = q.cdoc AND sp.snapshot_id < q."snapshotId"
							`;

							yield* track(
								"student_programmes",
								sql`
									INSERT INTO student_programmes (
										saz_cdoc, student_id, spec_name, programme_id, snapshot_id, change_no
									)
									SELECT q.cdoc, q."ownerId", q."specName", q."programmeId",
										q."snapshotId", nextval('change_no_seq')
									FROM ${programmes}
									WHERE NOT EXISTS (
										SELECT 1 FROM student_programmes sp WHERE sp.saz_cdoc = q.cdoc
									)
									RETURNING id, change_no, 'add' AS action
								`,
							);

							const listed = sql`
								${recordset(rows.enrollments, {
									sazCode: "text",
									cdoc: "text",
									kind: "text",
									status: "text",
									isStudentActive: "boolean",
									isForced: "boolean",
									groupNo: "smallint",
									grade: "smallint",
									sazCreatedAt: "timestamptz",
									sazUpdatedAt: "timestamptz",
								})}
								JOIN offerings o ON o.saz_code = r."sazCode"
								JOIN student_programmes sp ON sp.saz_cdoc = r.cdoc
							`;

							yield* track(
								"enrollments",
								sql`
									INSERT INTO enrollments (
										offering_id, student_programme_id, kind, status,
										is_student_active, is_forced, group_no, grade,
										saz_created_at, saz_updated_at, change_no
									)
									SELECT o.id, sp.id, r.kind, r.status, r."isStudentActive",
										r."isForced", r."groupNo", r.grade, r."sazCreatedAt",
										r."sazUpdatedAt", nextval('change_no_seq')
									FROM ${listed}
									WHERE NOT EXISTS (
										SELECT 1 FROM enrollments e
										WHERE e.offering_id = o.id AND e.student_programme_id = sp.id
									)
									RETURNING id, change_no, 'add' AS action
								`,
							);

							yield* track(
								"enrollments",
								sql`
									UPDATE enrollments e SET
										kind = r.kind, status = r.status,
										is_student_active = r."isStudentActive", is_forced = r."isForced",
										group_no = r."groupNo", grade = r.grade,
										saz_created_at = r."sazCreatedAt", saz_updated_at = r."sazUpdatedAt",
										removed_at = NULL, change_no = nextval('change_no_seq')
									FROM enrollments prev, ${listed}
									WHERE prev.id = e.id AND e.offering_id = o.id
										AND e.student_programme_id = sp.id
										AND (e.removed_at IS NOT NULL OR (
											e.kind, e.status, e.is_student_active, e.is_forced, e.group_no,
											e.grade, e.saz_created_at, e.saz_updated_at
										) IS DISTINCT FROM (
											r.kind, r.status, r."isStudentActive", r."isForced", r."groupNo",
											r.grade, r."sazCreatedAt", r."sazUpdatedAt"
										))
									RETURNING e.id, e.change_no,
										CASE WHEN prev.removed_at IS NULL THEN 'change' ELSE 'restore' END
											AS action
								`,
							);

							const listsOf = sql`
								${recordset(rows.lists, { sazCode: "text", snapshotId: "bigint", entryCount: "integer" })}
								JOIN offerings o ON o.saz_code = r."sazCode"
							`;

							const emptied = yield* sql`
								SELECT r."sazCode" FROM ${listsOf}
								WHERE r."entryCount" = 0 AND EXISTS (
									SELECT 1 FROM enrollments e
									WHERE e.offering_id = o.id AND e.removed_at IS NULL
								)
							`.pipe(Effect.flatMap(decodeCodes));

							yield* track(
								"enrollments",
								sql`
									UPDATE enrollments e
									SET removed_at = now(), change_no = nextval('change_no_seq')
									FROM (
										SELECT live.id FROM ${listsOf}
										JOIN enrollments live
											ON live.offering_id = o.id AND live.removed_at IS NULL
										LEFT JOIN (
											${recordset(
												rows.enrollments.map(({ sazCode, cdoc }) => ({
													sazCode,
													cdoc,
												})),
												{ sazCode: "text", cdoc: "text" },
												"x",
											)}
											JOIN student_programmes kept ON kept.saz_cdoc = x.cdoc
										) ON x."sazCode" = r."sazCode" AND kept.id = live.student_programme_id
										WHERE kept.id IS NULL
									) gone
									WHERE e.id = gone.id
									RETURNING e.id, e.change_no, 'remove' AS action
								`,
							);

							yield* sql`
								INSERT INTO enrollment_lists (offering_id, snapshot_id, entry_count)
								SELECT o.id, r."snapshotId", r."entryCount" FROM ${listsOf}
								ON CONFLICT (offering_id) DO UPDATE SET
									snapshot_id = excluded.snapshot_id,
									entry_count = excluded.entry_count, parsed_at = now()
							`;

							yield* track(
								"student_programmes",
								sql`
									UPDATE student_programmes sp
									SET removed_at = CASE WHEN sp.removed_at IS NULL THEN now() END,
										change_no = nextval('change_no_seq')
									WHERE (sp.removed_at IS NULL) <> EXISTS (
										SELECT 1 FROM enrollments e
										WHERE e.student_programme_id = sp.id AND e.removed_at IS NULL
									)
									RETURNING sp.id, sp.change_no,
										CASE WHEN sp.removed_at IS NULL THEN 'restore' ELSE 'remove' END
											AS action
								`,
							);

							yield* track(
								"students",
								sql`
									UPDATE students s
									SET removed_at = CASE WHEN s.removed_at IS NULL THEN now() END,
										change_no = nextval('change_no_seq')
									WHERE (s.removed_at IS NULL) <> EXISTS (
										SELECT 1 FROM student_programmes sp
										WHERE sp.student_id = s.id AND sp.removed_at IS NULL
									)
									RETURNING s.id, s.change_no,
										CASE WHEN s.removed_at IS NULL THEN 'restore' ELSE 'remove' END
											AS action
								`,
							);

							return {
								changes: mergeChangeCounts(written.flat()),
								parsed: current.length,
								emptied: emptied.map(({ sazCode }) => sazCode),
							};
						}),
					)
					.pipe(Effect.orDie);

			return StudentStore.of({ latestStudentPages, pages, write });
		}),
	);
}
