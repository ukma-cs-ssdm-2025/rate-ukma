import { Context, Effect, Layer, Schema } from "effect";
import { SqlClient, SqlSchema, type Statement } from "effect/sql";
import { ChangeLog, type NumberedTable } from "../changes/ChangeLog.ts";
import { recordsetOf } from "../db/recordset.ts";
import type { ParseTrigger } from "../offerings/OfferingStore.ts";
import { APOSTROPHES, type StudentList, studentRowsOf } from "./rows.ts";

const StudentsPage = Schema.Struct({
	id: Schema.BigInt,
	path: Schema.String,
	sazCode: Schema.String,
	content: Schema.String,
});

export type StudentsPage = typeof StudentsPage.Type;

/** What one batch of lists wrote: `parsed` lists, the САЗ codes of the
 *  lists that had live enrollments and are now empty, and of the empty
 *  lists `kept` unapplied because their card still shows enrollments. */
export interface ListsWritten {
	readonly parsed: number;
	readonly emptied: ReadonlyArray<string>;
	readonly kept: ReadonlyArray<string>;
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
		 *  rows whose content changed take a number. A new programme record
		 *  joins a student by email and first name and may open a
		 *  `student_match` case (ADR-0013). A person or programme record with
		 *  no live enrollment left is removed, and restored when one returns. A list already applied from a newer page keeps its rows,
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

			const decodeStarted = Schema.decodeUnknownEffect(
				Schema.Array(
					Schema.Struct({
						id: Schema.String,
						cdoc: Schema.String,
						email: Schema.NullOr(Schema.String),
						fullName: Schema.String,
						firstNameKey: Schema.NullOr(Schema.String),
						snapshotId: Schema.String,
					}),
				),
			);

			const decodePlaced = Schema.decodeUnknownEffect(
				Schema.Array(
					Schema.Struct({
						cdoc: Schema.String,
						studentId: Schema.String,
						candidateIds: Schema.Array(Schema.String),
						flagged: Schema.Boolean,
					}),
				),
			);

			const decodeEmptied = Schema.decodeUnknownEffect(
				Schema.Array(
					Schema.Struct({ sazCode: Schema.String, cardShows: Schema.Boolean }),
				),
			);

			/** `p` is a person row; a name with `*` keeps a stored one without,
			 *  and with it the stored first-name key. */
			const starKept = sql`p."fullName" LIKE '%*%' AND s.full_name NOT LIKE '%*%'`;
			const keptName = sql`CASE WHEN ${starKept} THEN s.full_name ELSE p."fullName" END`;

			const keptKey = sql`
				CASE WHEN ${starKept} THEN s.first_name_key ELSE p."firstNameKey" END
			`;

			/** The first word of a name, compared as `firstNameKeyOf` compares. */
			const surnameOf = (name: Statement.Fragment) => sql`
				lower(translate(split_part(${name}, ' ', 1), ${APOSTROPHES}, ${"'".repeat(APOSTROPHES.length)}))
			`;

			const recordColumns = {
				cdoc: "text",
				email: "text",
				fullName: "text",
				firstNameKey: "text",
				specName: "text",
				snapshotId: "bigint",
				sazCodes: "text[]",
			} as const;

			const write = (lists: ReadonlyArray<StudentList>, parseId: bigint) =>
				changes
					.withTurn(
						Effect.gen(function* () {
							const track = (
								table: NumberedTable,
								statement: Statement.Fragment,
							) => changes.track(table, { parseId }, statement);

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
								return { parsed: 0, emptied: [], kept: [] };
							}

							const codes = current.map(({ sazCode }) => sazCode);

							const cdocs = [
								...new Set(
									current.flatMap(({ entries }) =>
										entries.map(({ cdoc }) => cdoc),
									),
								),
							];

							const stored =
								cdocs.length === 0 ? [] : yield* findProgrammes(cdocs);

							const storedAt = new Map(
								stored.map(({ cdoc, snapshotId }) => [cdoc, snapshotId]),
							);

							const rows = studentRowsOf(current, storedAt);

							// A new record joins a student by email and first name, never by
							// email alone (ADR-0013). Each pair no student has yet starts one,
							// named by its newest record; a record without either starts its
							// own (D3).
							const fresh = rows.programmes.filter(
								({ cdoc }) => !storedAt.has(cdoc),
							);

							const pairOf = sql`coalesce(r.email || ' ' || r."firstNameKey", r.cdoc)`;

							const started =
								fresh.length === 0
									? []
									: yield* sql`
											SELECT 'stu_' || uuidv7() AS id, n.* FROM (
												SELECT DISTINCT ON (${pairOf}) r.cdoc, r.email, r."fullName",
													r."firstNameKey", r."snapshotId"::text AS "snapshotId"
												FROM ${recordset(fresh, recordColumns)}
												WHERE NOT EXISTS (
													SELECT 1 FROM students s
													WHERE s.email = r.email AND s.first_name_key = r."firstNameKey"
												)
												ORDER BY ${pairOf}, r."snapshotId" DESC, r.cdoc DESC
											) n
										`.pipe(Effect.flatMap(decodeStarted));

							yield* track(
								"students",
								sql`
									INSERT INTO students (
										id, email, first_name_key, full_name, snapshot_id, change_no
									)
									SELECT id, email, "firstNameKey", "fullName", "snapshotId",
										nextval('change_no_seq')
									FROM ${recordset(started, { id: "text", cdoc: "text", email: "text", fullName: "text", firstNameKey: "text", snapshotId: "bigint" })}
									RETURNING id, change_no, 'add' AS action
								`,
							).pipe(Effect.when(Effect.succeed(started.length > 0)));

							const ownStudent = new Map(
								started.flatMap(({ id, cdoc, email, firstNameKey }) =>
									email === null || firstNameKey === null ? [[cdoc, id]] : [],
								),
							);

							// Of several matching students the record joins the one with the
							// newest first enrollment. A tie, or a surname other than its
							// student's, flags the record for a `student_match` case (D14).
							const placed =
								fresh.length === 0
									? []
									: yield* sql`
											SELECT r.cdoc, coalesce(r."studentId", m.ids[1]) AS "studentId",
												coalesce(m.ids, '{}') AS "candidateIds",
												coalesce(
													cardinality(m.ids) > 1
														OR ${surnameOf(sql`j.full_name`)} <> ${surnameOf(sql`r."fullName"`)},
													false
												) AS flagged
											FROM ${recordset(
												fresh.map(
													({ cdoc, email, fullName, firstNameKey }) => ({
														cdoc,
														email,
														fullName,
														firstNameKey,
														studentId: ownStudent.get(cdoc) ?? null,
													}),
												),
												{
													cdoc: "text",
													email: "text",
													fullName: "text",
													firstNameKey: "text",
													studentId: "text",
												},
											)}
											LEFT JOIN LATERAL (
												SELECT array_agg(c.id ORDER BY c.first DESC NULLS LAST, c.id DESC) AS ids
												FROM (
													SELECT s.id, (
														SELECT min(e.saz_created_at) FROM student_programmes sp
														JOIN enrollments e ON e.student_programme_id = sp.id
														WHERE sp.student_id = s.id
													) AS first
													FROM students s
													WHERE r."studentId" IS NULL AND s.email = r.email
														AND s.first_name_key = r."firstNameKey"
												) c
											) m ON true
											LEFT JOIN students j ON j.id = m.ids[1]
										`.pipe(Effect.flatMap(decodePlaced));

							const studentOf = new Map(
								placed.map(({ cdoc, studentId }) => [cdoc, studentId]),
							);

							const programmes = sql`(
								SELECT r.*, coalesce(
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
												AND o.saz_code NOT IN ${sql.in(codes)}
										)
										HAVING count(DISTINCT pr.id) = 1
									),
									(
										SELECT min(pr.id) FROM programmes pr
										WHERE pr.name = r."specName" HAVING count(*) = 1
									)
								) AS "programmeId"
								FROM ${recordset(
									rows.programmes.map(
										({ cdoc, specName, snapshotId, sazCodes }) => ({
											cdoc,
											specName,
											snapshotId,
											sazCodes,
											studentId: studentOf.get(cdoc) ?? null,
										}),
									),
									{
										cdoc: "text",
										specName: "text",
										snapshotId: "bigint",
										sazCodes: "text[]",
										studentId: "text",
									},
								)}
							) q`;

							// A list names the programme without its level (D12); the cards of
							// the record's offerings that list that name give it, with this
							// batch's lists in place of their stored enrollments. A record
							// whose cards name both levels links only a name of one level.
							yield* track(
								"student_programmes",
								sql`
									UPDATE student_programmes sp
									SET spec_name = q."specName", programme_id = q."programmeId",
										snapshot_id = q."snapshotId", change_no = nextval('change_no_seq')
									FROM ${programmes}
									WHERE sp.saz_cdoc = q.cdoc
										AND (sp.spec_name, sp.programme_id) IS DISTINCT FROM
											(q."specName", q."programmeId")
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
									SELECT q.cdoc, q."studentId", q."specName", q."programmeId",
										q."snapshotId", nextval('change_no_seq')
									FROM ${programmes}
									WHERE q."studentId" IS NOT NULL
									RETURNING id, change_no, 'add' AS action
								`,
							);

							// A record keeps its student (D1). Of each student's records in the
							// batch, the newest email and the newest name without `*` (D6), or
							// the newest name when all have it, set the student, after the new
							// records joined, so a second parse of the same lists changes
							// nothing. A record without an email keeps the student's, and one
							// older than the student's details never sets them.
							const newest = sql`r."snapshotId" DESC, r.cdoc DESC`;
							const byName = sql`(r."fullName" LIKE '%*%'), ${newest}`;
							const notOlder = sql`r."snapshotId" >= s.snapshot_id`;

							const persons = sql`(
								SELECT s.id AS "studentId",
									(array_agg(r.email ORDER BY ${newest})
										FILTER (WHERE r.email IS NOT NULL AND ${notOlder}))[1] AS email,
									(array_agg(r."fullName" ORDER BY ${byName}) FILTER (WHERE ${notOlder}))[1]
										AS "fullName",
									(array_agg(r."firstNameKey" ORDER BY ${byName}) FILTER (WHERE ${notOlder}))[1]
										AS "firstNameKey",
									max(r."snapshotId") AS "snapshotId"
								FROM ${recordset(rows.programmes, recordColumns)}
								JOIN student_programmes sp ON sp.saz_cdoc = r.cdoc
								JOIN students s ON s.id = sp.student_id
								GROUP BY s.id
							) p`;

							yield* track(
								"students",
								sql`
									UPDATE students s
									SET full_name = ${keptName}, first_name_key = ${keptKey},
										email = coalesce(p.email, s.email), snapshot_id = p."snapshotId",
										change_no = nextval('change_no_seq')
									FROM ${persons}
									WHERE s.id = p."studentId" AND s.snapshot_id <= p."snapshotId"
										AND (s.full_name, s.first_name_key, s.email) IS DISTINCT FROM
											(${keptName}, ${keptKey}, coalesce(p.email, s.email))
									RETURNING s.id, s.change_no, 'change' AS action
								`,
							);

							yield* sql`
								UPDATE students s SET snapshot_id = p."snapshotId"
								FROM ${persons}
								WHERE s.id = p."studentId" AND s.snapshot_id < p."snapshotId"
							`;

							const flagged = placed.filter(({ flagged }) => flagged);

							// The case's subject is the record and its safe answer the student
							// it joined. A record is new only once; the guard keeps it so.
							yield* track(
								"review_cases",
								sql`
									INSERT INTO review_cases (
										kind, subject_id, candidates, safe_answer, change_no
									)
									SELECT 'student_match', sp.id,
										jsonb_build_object('studentIds', to_jsonb(c."candidateIds")),
										jsonb_build_object('studentId', c."studentId"),
										nextval('change_no_seq')
									FROM ${recordset(
										flagged.map(({ cdoc, studentId, candidateIds }) => ({
											cdoc,
											studentId,
											candidateIds,
										})),
										{ cdoc: "text", studentId: "text", candidateIds: "text[]" },
										"c",
									)}
									JOIN student_programmes sp ON sp.saz_cdoc = c.cdoc
									WHERE NOT EXISTS (
										SELECT 1 FROM review_cases rc
										WHERE rc.kind = 'student_match' AND rc.subject_id = sp.id
									)
									RETURNING id, change_no, 'add' AS action
								`,
							).pipe(Effect.when(Effect.succeed(flagged.length > 0)));

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

							const listColumns = {
								sazCode: "text",
								snapshotId: "bigint",
								entryCount: "integer",
							} as const;

							// An empty list comes with a card without the enrollment block
							// (A7). One that empties while its card still shows enrollments
							// is kept unapplied and unrecorded, so the next parse tries it
							// again; when the card loses the block too, the list applies.
							const emptiedLists = yield* sql`
								SELECT r."sazCode", o.enrolled_active IS NOT NULL AS "cardShows"
								FROM ${recordset(rows.lists, listColumns)}
								JOIN offerings o ON o.saz_code = r."sazCode"
								WHERE r."entryCount" = 0 AND EXISTS (
									SELECT 1 FROM enrollments e
									WHERE e.offering_id = o.id AND e.removed_at IS NULL
								)
							`.pipe(Effect.flatMap(decodeEmptied));

							const kept = new Set(
								emptiedLists.flatMap(({ sazCode, cardShows }) =>
									cardShows ? [sazCode] : [],
								),
							);

							const emptied = emptiedLists.filter(
								({ cardShows }) => !cardShows,
							);

							const listsOf = sql`
								${recordset(
									rows.lists.filter(({ sazCode }) => !kept.has(sazCode)),
									listColumns,
								)}
								JOIN offerings o ON o.saz_code = r."sazCode"
							`;

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

							// Only records on this batch's lists, and their students, can
							// have lost or regained their last enrollment.
							const touched = sql`(
								SELECT e.student_programme_id FROM enrollments e
								JOIN offerings o ON o.id = e.offering_id
								WHERE o.saz_code IN ${sql.in(codes)}
							)`;

							yield* track(
								"student_programmes",
								sql`
									UPDATE student_programmes sp
									SET removed_at = CASE WHEN sp.removed_at IS NULL THEN now() END,
										change_no = nextval('change_no_seq')
									WHERE sp.id IN ${touched} AND (sp.removed_at IS NULL) <> EXISTS (
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
									WHERE s.id IN (
										SELECT sp.student_id FROM student_programmes sp
										WHERE sp.id IN ${touched}
									) AND (s.removed_at IS NULL) <> EXISTS (
										SELECT 1 FROM student_programmes sp
										WHERE sp.student_id = s.id AND sp.removed_at IS NULL
									)
									RETURNING s.id, s.change_no,
										CASE WHEN s.removed_at IS NULL THEN 'restore' ELSE 'remove' END
											AS action
								`,
							);

							return {
								parsed: current.length - kept.size,
								emptied: emptied.map(({ sazCode }) => sazCode),
								kept: [...kept],
							};
						}),
					)
					.pipe(Effect.orDie);

			return StudentStore.of({ latestStudentPages, pages, write });
		}),
	);
}
