import { Context, Effect, Layer, Schema, SchemaTransformation } from "effect";
import { SqlClient, SqlSchema, type Statement } from "effect/sql";
import {
	Department,
	Faculty,
	Offering,
	type PageOf,
	type PageRequest,
	Programme,
	ReviewCase,
	Term,
	toPage,
} from "./lists.ts";

const Request = Schema.Struct({ after: Schema.Int, limit: Schema.Int });

/** pg returns bigint as a JS bigint; change numbers stay far below 2^53. */
const numbered = Schema.fieldsAssign({
	changeNo: Schema.BigInt.pipe(
		Schema.decodeTo(
			Schema.Int,
			SchemaTransformation.transform({ decode: Number, encode: BigInt }),
		),
	),
});

type Read<S extends Schema.Top> = (
	request: PageRequest,
) => Effect.Effect<PageOf<S["Type"]>>;

/** Each list in change-number order, removed rows included, so a reader
 *  applies removals as it syncs. */
export class ListReader extends Context.Service<
	ListReader,
	{
		terms: Read<typeof Term>;
		faculties: Read<typeof Faculty>;
		departments: Read<typeof Department>;
		programmes: Read<typeof Programme>;
		offerings: Read<typeof Offering>;
		reviewCases: Read<typeof ReviewCase>;
	}
>()("ukma-data/lists/ListReader") {
	static readonly layer = Layer.effect(
		ListReader,
		Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;

			const findUpdatedAt = SqlSchema.findOne({
				Request: Schema.Void,
				Result: Schema.Struct({ at: Schema.NullOr(Schema.Date) }),
				execute: () => sql`
					SELECT max(finished_at) AS at FROM runs
					WHERE status = 'succeeded' AND source_part LIKE 'saz-courses:%'
				`,
			});

			const reader = <A extends { readonly changeNo: number }>(
				item: Schema.Decoder<A>,
				select: (after: number, rows: number) => Statement.Statement<object>,
			) => {
				const find = SqlSchema.findAll({
					Request,
					Result: item,
					execute: ({ after, limit }) => select(after, limit + 1),
				});

				return (request: PageRequest): Effect.Effect<PageOf<A>> =>
					Effect.all([find(request), findUpdatedAt()]).pipe(
						Effect.map(([rows, { at }]) => toPage(rows, request, at)),
						Effect.orDie,
					);
			};

			return ListReader.of({
				terms: reader(
					Term.pipe(numbered),
					(after, rows) => sql`
						SELECT id, code, academic_year AS "academicYear", season,
							change_no AS "changeNo"
						FROM terms
						WHERE change_no > ${after} ORDER BY change_no LIMIT ${rows}
					`,
				),
				faculties: reader(
					Faculty.pipe(numbered),
					(after, rows) => sql`
						SELECT id, name, saz_filter_id AS "sazFilterId",
							change_no AS "changeNo", removed_at AS "removedAt"
						FROM faculties
						WHERE change_no > ${after} ORDER BY change_no LIMIT ${rows}
					`,
				),
				departments: reader(
					Department.pipe(numbered),
					(after, rows) => sql`
						SELECT id, name, saz_filter_id AS "sazFilterId",
							faculty_id AS "facultyId", change_no AS "changeNo",
							removed_at AS "removedAt"
						FROM departments
						WHERE change_no > ${after} ORDER BY change_no LIMIT ${rows}
					`,
				),
				programmes: reader(
					Programme.pipe(numbered),
					(after, rows) => sql`
						SELECT id, name, level, saz_filter_id AS "sazFilterId",
							change_no AS "changeNo", removed_at AS "removedAt"
						FROM programmes
						WHERE change_no > ${after} ORDER BY change_no LIMIT ${rows}
					`,
				),
				offerings: reader(
					Offering.pipe(numbered),
					(after, rows) => sql`
						SELECT o.id, o.saz_code AS "sazCode",
							o.academic_year AS "academicYear", o.title,
							o.faculty_id AS "facultyId", o.department_id AS "departmentId",
							o.level, o.format, o.credits::float8 AS credits, o.hours,
							o.study_year AS "studyYear", o.status,
							o.is_practical AS "isPractical", o.annotation,
							o.max_students AS "maxStudents", o.max_groups AS "maxGroups",
							o.computed_max_students AS "computedMaxStudents",
							o.group_size_min AS "groupSizeMin",
							o.group_size_max AS "groupSizeMax",
							o.enrolled_active AS "enrolledActive",
							coalesce(t.terms, '[]') AS terms,
							coalesce(p.programmes, '[]') AS programmes,
							o.change_no AS "changeNo", o.removed_at AS "removedAt"
						FROM offerings o
						LEFT JOIN LATERAL (
							SELECT jsonb_agg(jsonb_build_object(
								'termId', ot.term_id, 'semesters', ot.semesters,
								'credits', ot.credits, 'hoursPerWeek', ot.hours_per_week,
								'lectureHours', ot.lecture_hours,
								'seminarHours', ot.seminar_hours,
								'practiceHours', ot.practice_hours, 'control', ot.control
							) ORDER BY ot.term_id) AS terms
							FROM offering_terms ot WHERE ot.offering_id = o.id
						) t ON true
						LEFT JOIN LATERAL (
							SELECT jsonb_agg(jsonb_build_object(
								'programmeId', op.programme_id, 'kind', op.kind
							) ORDER BY op.programme_id) AS programmes
							FROM offering_programmes op WHERE op.offering_id = o.id
						) p ON true
						WHERE o.change_no > ${after} ORDER BY o.change_no LIMIT ${rows}
					`,
				),
				reviewCases: reader(
					ReviewCase.pipe(numbered),
					(after, rows) => sql`
						SELECT id, kind, subject_id AS "subjectId", candidates,
							safe_answer AS "safeAnswer", status,
							'run_' || run_id AS "runId", decision_id AS "decisionId",
							opened_at AS "openedAt", change_no AS "changeNo"
						FROM review_cases
						WHERE change_no > ${after} ORDER BY change_no LIMIT ${rows}
					`,
				),
			});
		}),
	);
}
