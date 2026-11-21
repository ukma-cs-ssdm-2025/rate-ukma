import { Context, Effect, Layer, Schema } from "effect";
import { SqlClient, SqlSchema } from "effect/sql";
import { ChangeLog, type ChangeSource } from "../changes/ChangeLog.ts";
import { recordsetOf } from "../db/recordset.ts";
import type {
	MatchDiscipline,
	MatchOffering,
	MatchTeacher,
	OfferingTeacher,
} from "./matching.ts";

const Role = Schema.Literals([
	"LECTURER",
	"PRACTICE_TEACHER",
	"LECTURER_AND_PRACTICE_TEACHER",
]);

const OfferingInput = Schema.Struct({
	id: Schema.String,
	title: Schema.String,
	credits: Schema.Number,
	departmentName: Schema.NullOr(Schema.String),
	level: Schema.Literals(["bachelor", "master"]),
	sazTeachers: Schema.NullOr(Schema.String),
});

const DisciplineInput = Schema.Struct({
	title: Schema.String,
	credits: Schema.Number,
	departmentName: Schema.NullOr(Schema.String),
	level: Schema.NullOr(Schema.Literals(["bachelor", "master"])),
	teachers: Schema.Array(Schema.Struct({ smartId: Schema.Int, role: Role })),
});

const TeacherInput = Schema.Struct({
	smartId: Schema.Int,
	lastName: Schema.String,
});

export interface MatchInputs {
	readonly offerings: ReadonlyArray<MatchOffering>;
	readonly disciplines: ReadonlyArray<MatchDiscipline>;
	readonly teachers: ReadonlyArray<MatchTeacher>;
}

export class OfferingTeacherStore extends Context.Service<
	OfferingTeacherStore,
	{
		/** Live offerings, disciplines with their teachers, and teachers. */
		inputs(): Effect.Effect<MatchInputs>;
		/** Makes each offering's teachers the given links, in one writers'
		 *  turn. An offering whose teacher set or roles changed takes a new
		 *  change number. Links to a teacher missing from `instructors` are
		 *  dropped. Returns how many offerings changed. */
		write(
			links: ReadonlyArray<OfferingTeacher>,
			source: ChangeSource,
		): Effect.Effect<number>;
	}
>()("ukma-data/smart/OfferingTeacherStore") {
	static readonly layer = Layer.effect(
		OfferingTeacherStore,
		Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			const changes = yield* ChangeLog;
			const recordset = recordsetOf(sql);

			const findOfferings = SqlSchema.findAll({
				Request: Schema.Void,
				Result: OfferingInput,
				execute: () => sql`
					SELECT o.id, o.title, o.credits::float8 AS credits,
						d.name AS "departmentName", o.level,
						o.saz_teachers AS "sazTeachers"
					FROM offerings o
					LEFT JOIN departments d ON d.id = o.department_id
					WHERE o.removed_at IS NULL
				`,
			});

			const findDisciplines = SqlSchema.findAll({
				Request: Schema.Void,
				Result: DisciplineInput,
				execute: () => sql`
					SELECT d.title, d.credits::float8 AS credits,
						d.department_name AS "departmentName", d.level,
						coalesce(jsonb_agg(jsonb_build_object(
							'smartId', l.instructor_smart_id, 'role', l.role
						)) FILTER (WHERE l.discipline_id IS NOT NULL), '[]') AS teachers
					FROM smart_disciplines d
					LEFT JOIN smart_discipline_instructors l ON l.discipline_id = d.id
					WHERE d.removed_at IS NULL
					GROUP BY d.id
				`,
			});

			const findTeachers = SqlSchema.findAll({
				Request: Schema.Void,
				Result: TeacherInput,
				execute: () => sql`
					SELECT smart_id AS "smartId", last_name AS "lastName"
					FROM instructors WHERE removed_at IS NULL
				`,
			});

			const inputs = () =>
				Effect.all({
					offerings: findOfferings(),
					disciplines: findDisciplines(),
					teachers: findTeachers(),
				}).pipe(Effect.orDie);

			const write = (
				links: ReadonlyArray<OfferingTeacher>,
				source: ChangeSource,
			) =>
				changes.withTurn(
					Effect.gen(function* () {
						const wanted = sql`
							SELECT r."offeringId" AS offering_id, i.id AS instructor_id, r.role
							FROM ${recordset(links, {
								offeringId: "text",
								smartId: "integer",
								role: "text",
							})}
							JOIN instructors i
								ON i.smart_id = r."smartId" AND i.removed_at IS NULL
						`;

						// Matching reads live offerings only, so a removed offering
						// keeps its last teachers and its change number.
						const held = sql`
							SELECT oi.offering_id, oi.instructor_id, oi.role
							FROM offering_instructors oi
							JOIN offerings o ON o.id = oi.offering_id AND o.removed_at IS NULL
						`;

						const changed = (yield* sql<{ readonly id: string }>`
							SELECT DISTINCT offering_id AS id FROM (
								(${wanted} EXCEPT ${held})
								UNION ALL
								(${held} EXCEPT ${wanted})
							) diff
						`).map(({ id }) => id);

						if (changed.length === 0) {
							return 0;
						}

						const ids = sql`(
							SELECT jsonb_array_elements_text(${JSON.stringify(changed)}::jsonb)
						)`;

						yield* sql`
							DELETE FROM offering_instructors WHERE offering_id IN ${ids}
						`;
						yield* sql`
							INSERT INTO offering_instructors (offering_id, instructor_id, role)
							SELECT offering_id, instructor_id, role FROM (${wanted}) w
							WHERE offering_id IN ${ids}
						`;

						const numbered = yield* changes.track(
							"offerings",
							source,
							sql`
								UPDATE offerings SET change_no = nextval('change_no_seq')
								WHERE id IN ${ids}
								RETURNING id, change_no, 'change' AS action
							`,
						);

						return numbered.length;
					}),
				);

			return OfferingTeacherStore.of({ inputs, write });
		}),
	);
}
