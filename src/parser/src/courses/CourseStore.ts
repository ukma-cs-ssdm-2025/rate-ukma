import { Context, Effect, Layer, Schema } from "effect";
import { SqlClient, SqlSchema } from "effect/sql";
import {
	ChangeLog,
	type ChangeSource,
	type Turn,
} from "../changes/ChangeLog.ts";
import { recordsetOf } from "../db/recordset.ts";
import type {
	CourseKey,
	LiveOffering,
	OfferingLink,
	StoredCourse,
} from "./courses.ts";

const Level = Schema.Literals(["bachelor", "master"]);

const LiveOfferingRow = Schema.Struct({
	id: Schema.String,
	title: Schema.String,
	departmentId: Schema.NullOr(Schema.String),
	level: Level,
	courseId: Schema.NullOr(Schema.String),
	courseSource: Schema.NullOr(Schema.Literals(["rule", "decision"])),
});

const CourseRow = Schema.Struct({
	id: Schema.String,
	title: Schema.String,
	departmentId: Schema.NullOr(Schema.String),
	level: Level,
	removed: Schema.Boolean,
	mergedInto: Schema.NullOr(Schema.String),
});

/** Every method needs the writers' turn, so the rule reads and writes the
 *  same rows. */
export class CourseStore extends Context.Service<
	CourseStore,
	{
		liveOfferings: Effect.Effect<ReadonlyArray<LiveOffering>, never, Turn>;
		/** Every course, removed and merged ones included. */
		courses: Effect.Effect<ReadonlyArray<StoredCourse>, never, Turn>;
		/** Adds a course for each key and brings the removed courses back. */
		open(
			source: ChangeSource,
			add: ReadonlyArray<CourseKey>,
			restore: ReadonlyArray<string>,
		): Effect.Effect<void, never, Turn>;
		/** Links the offerings by the rule, then removes the emptied courses. */
		link(
			source: ChangeSource,
			links: ReadonlyArray<OfferingLink>,
			remove: ReadonlyArray<string>,
		): Effect.Effect<void, never, Turn>;
	}
>()("ukma-data/courses/CourseStore") {
	static readonly layer = Layer.effect(
		CourseStore,
		Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			const changes = yield* ChangeLog;
			const recordset = recordsetOf(sql);

			const findLiveOfferings = SqlSchema.findAll({
				Request: Schema.Void,
				Result: LiveOfferingRow,
				execute: () => sql`
					SELECT id, title, department_id AS "departmentId", level,
						course_id AS "courseId", course_source AS "courseSource"
					FROM offerings
					WHERE removed_at IS NULL
					ORDER BY id
				`,
			});

			const findCourses = SqlSchema.findAll({
				Request: Schema.Void,
				Result: CourseRow,
				execute: () => sql`
					SELECT id, title, department_id AS "departmentId", level,
						removed_at IS NOT NULL AS removed, merged_into AS "mergedInto"
					FROM courses
					ORDER BY id
				`,
			});

			const open = (
				source: ChangeSource,
				add: ReadonlyArray<CourseKey>,
				restore: ReadonlyArray<string>,
			) =>
				Effect.gen(function* () {
					if (add.length > 0) {
						yield* changes.track(
							"courses",
							source,
							sql`
								INSERT INTO courses (title, department_id, level, change_no)
								SELECT title, "departmentId", level, nextval('change_no_seq')
								FROM ${recordset(add, { title: "text", departmentId: "text", level: "text" })}
								RETURNING id, change_no, 'add' AS action
							`,
						);
					}

					if (restore.length > 0) {
						yield* changes.track(
							"courses",
							source,
							sql`
								UPDATE courses
								SET removed_at = NULL, change_no = nextval('change_no_seq')
								WHERE id IN ${sql.in(restore)} AND removed_at IS NOT NULL
								RETURNING id, change_no, 'restore' AS action
							`,
						);
					}
				});

			const link = (
				source: ChangeSource,
				links: ReadonlyArray<OfferingLink>,
				remove: ReadonlyArray<string>,
			) =>
				Effect.gen(function* () {
					if (links.length > 0) {
						yield* changes.track(
							"offerings",
							source,
							sql`
								UPDATE offerings o
								SET course_id = r."courseId", course_source = 'rule',
									change_no = nextval('change_no_seq')
								FROM ${recordset(links, { offeringId: "text", courseId: "text" })}
								WHERE o.id = r."offeringId"
									AND o.course_id IS DISTINCT FROM r."courseId"
								RETURNING o.id, o.change_no, 'change' AS action
							`,
						);
					}

					if (remove.length > 0) {
						yield* changes.track(
							"courses",
							source,
							sql`
								UPDATE courses
								SET removed_at = now(), change_no = nextval('change_no_seq')
								WHERE id IN ${sql.in(remove)} AND removed_at IS NULL
								RETURNING id, change_no, 'remove' AS action
							`,
						);
					}
				});

			return CourseStore.of({
				liveOfferings: findLiveOfferings().pipe(Effect.orDie),
				courses: findCourses().pipe(Effect.orDie),
				open,
				link,
			});
		}),
	);
}
