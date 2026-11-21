import { Context, Effect, Layer, type Option, Schema } from "effect";
import { SqlClient, SqlSchema } from "effect/sql";
import { ChangeLog, type Turn } from "../changes/ChangeLog.ts";

export const CaseRow = Schema.Struct({
	id: Schema.String,
	kind: Schema.String,
	status: Schema.Literals(["open", "decided", "obsolete"]),
	openedAt: Schema.Date,
	recordId: Schema.String,
	candidateIds: Schema.Array(Schema.String),
	studentId: Schema.NullOr(Schema.String),
});

export type CaseRow = typeof CaseRow.Type;

/** A person as stored, with the programme record that names them and the
 *  students page that record was last read from. */
export const PersonRow = Schema.Struct({
	studentId: Schema.String,
	fullName: Schema.String,
	recordId: Schema.NullOr(Schema.String),
	cdoc: Schema.NullOr(Schema.String),
	programme: Schema.NullOr(Schema.String),
	content: Schema.NullOr(Schema.String),
});

export type PersonRow = typeof PersonRow.Type;

export class StudentCaseStore extends Context.Service<
	StudentCaseStore,
	{
		find(id: string): Effect.Effect<Option.Option<CaseRow>>;
		/** The programme record that opened a case, with its student. */
		record(recordId: string): Effect.Effect<Option.Option<PersonRow>>;
		/** Each student with their newest programme record other than
		 *  `exceptRecord`, or none when they have no other. */
		candidates(
			studentIds: ReadonlyArray<string>,
			exceptRecord: string,
		): Effect.Effect<ReadonlyArray<PersonRow>>;
		/** Closes an open case; false when it is not open. */
		close(id: string): Effect.Effect<boolean, never, Turn>;
	}
>()("ukma-data/students/StudentCaseStore") {
	static readonly layer = Layer.effect(
		StudentCaseStore,
		Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			const changes = yield* ChangeLog;

			const findCase = SqlSchema.findOneOption({
				Request: Schema.String,
				Result: CaseRow,
				execute: (id) => sql`
					SELECT id, kind, status, opened_at AS "openedAt",
						subject_id AS "recordId",
						coalesce(
							ARRAY(SELECT jsonb_array_elements_text(candidates -> 'studentIds')),
							'{}'
						) AS "candidateIds",
						safe_answer ->> 'studentId' AS "studentId"
					FROM review_cases
					WHERE id = ${id}
				`,
			});

			const findRecord = SqlSchema.findOneOption({
				Request: Schema.String,
				Result: PersonRow,
				execute: (recordId) => sql`
					SELECT s.id AS "studentId", s.full_name AS "fullName",
						sp.id AS "recordId", sp.saz_cdoc AS cdoc,
						coalesce(p.name, sp.spec_name) AS programme, ps.content
					FROM student_programmes sp
					JOIN students s ON s.id = sp.student_id
					LEFT JOIN programmes p ON p.id = sp.programme_id
					JOIN page_snapshots ps ON ps.id = sp.snapshot_id
					WHERE sp.id = ${recordId}
				`,
			});

			const findCandidates = SqlSchema.findAll({
				Request: Schema.Struct({
					studentIds: Schema.Array(Schema.String),
					exceptRecord: Schema.String,
				}),
				Result: PersonRow,
				execute: ({ studentIds, exceptRecord }) => sql`
					SELECT s.id AS "studentId", s.full_name AS "fullName",
						r.id AS "recordId", r.saz_cdoc AS cdoc, r.programme, r.content
					FROM students s
					LEFT JOIN LATERAL (
						SELECT sp.id, sp.saz_cdoc,
							coalesce(p.name, sp.spec_name) AS programme, ps.content
						FROM student_programmes sp
						LEFT JOIN programmes p ON p.id = sp.programme_id
						JOIN page_snapshots ps ON ps.id = sp.snapshot_id
						WHERE sp.student_id = s.id AND sp.id <> ${exceptRecord}
						ORDER BY sp.snapshot_id DESC, sp.id DESC
						LIMIT 1
					) r ON true
					WHERE s.id IN ${sql.in(studentIds)}
					ORDER BY s.id
				`,
			});

			const decision = {};

			const close = (id: string) =>
				changes
					.track(
						"review_cases",
						decision,
						sql`
							UPDATE review_cases
							SET status = 'decided', change_no = nextval('change_no_seq')
							WHERE id = ${id} AND status = 'open'
							RETURNING id, change_no, 'change' AS action
						`,
					)
					.pipe(Effect.map((written) => written.length > 0));

			return StudentCaseStore.of({
				find: (id) => findCase(id).pipe(Effect.orDie),
				record: (recordId) => findRecord(recordId).pipe(Effect.orDie),
				candidates: (studentIds, exceptRecord) =>
					studentIds.length === 0
						? Effect.succeed([])
						: findCandidates({ studentIds, exceptRecord }).pipe(Effect.orDie),
				close,
			});
		}),
	);
}
