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
	CourseMerge,
	LiveOffering,
	OfferingLink,
	StoredCourse,
} from "./courses.ts";

const Level = Schema.Literals(["bachelor", "master"]);

const LiveOfferingRow = Schema.Struct({
	id: Schema.String,
	academicYear: Schema.Int,
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
	mergeSource: Schema.NullOr(Schema.Literals(["rule", "decision"])),
});

/** Every method needs the writers' turn, so the rule reads and writes the
 *  same rows. */
export class CourseStore extends Context.Service<
	CourseStore,
	{
		liveOfferings: Effect.Effect<ReadonlyArray<LiveOffering>, never, Turn>;
		/** Every course, removed and merged ones included. */
		courses: Effect.Effect<ReadonlyArray<StoredCourse>, never, Turn>;
		/** Adds a course for each key, brings the removed courses back and
		 *  undoes the rule's merges. */
		open(
			source: ChangeSource,
			add: ReadonlyArray<CourseKey>,
			restore: ReadonlyArray<string>,
			unmerge: ReadonlyArray<string>,
		): Effect.Effect<void, never, Turn>;
		/** Links the offerings by the rule, then merges the handed-off courses
		 *  (or points a rule merge at its new course) and removes the other
		 *  emptied ones. */
		link(
			source: ChangeSource,
			links: ReadonlyArray<OfferingLink>,
			merge: ReadonlyArray<CourseMerge>,
			remove: ReadonlyArray<string>,
		): Effect.Effect<void, never, Turn>;
		/** The courses of these ids that exist. */
		find(
			ids: ReadonlyArray<string>,
		): Effect.Effect<ReadonlyArray<StoredCourse>, never, Turn>;
		/** A staff merge: moves every offering of the course to `into`, held
		 *  there by the decision, brings `into` back if it was removed and now
		 *  holds a live offering, then merges the course. */
		decideMerge(id: string, into: string): Effect.Effect<void, never, Turn>;
		/** Undoes a merge: the course comes back and takes back, held by the
		 *  decision, the offerings of its key from the courses its merge leads
		 *  to. */
		decideUnmerge(id: string): Effect.Effect<void, never, Turn>;
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
					SELECT id, academic_year AS "academicYear", title,
						department_id AS "departmentId", level, course_id AS "courseId", course_source AS "courseSource"
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
						removed_at IS NOT NULL AS removed, merged_into AS "mergedInto",
						merge_source AS "mergeSource"
					FROM courses
					ORDER BY id
				`,
			});

			const open = (
				source: ChangeSource,
				add: ReadonlyArray<CourseKey>,
				restore: ReadonlyArray<string>,
				unmerge: ReadonlyArray<string>,
			) =>
				Effect.gen(function* () {
					if (unmerge.length > 0) {
						yield* changes.track(
							"courses",
							source,
							sql`
								UPDATE courses
								SET merged_into = NULL, merge_source = NULL, removed_at = NULL,
									change_no = nextval('change_no_seq')
								WHERE id IN ${sql.in(unmerge)} AND merge_source = 'rule'
								RETURNING id, change_no, 'restore' AS action
							`,
						);
					}

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
				merge: ReadonlyArray<CourseMerge>,
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

					// Removed with the merge, so a reader that applies removals drops it.
					if (merge.length > 0) {
						yield* changes.track(
							"courses",
							source,
							sql`
								UPDATE courses c
								SET merged_into = r.into, merge_source = 'rule',
									removed_at = coalesce(c.removed_at, now()),
									change_no = nextval('change_no_seq')
								FROM courses prev, ${recordset(merge, { courseId: "text", into: "text" })}
								WHERE c.id = r."courseId" AND prev.id = c.id
									AND c.merged_into IS DISTINCT FROM r.into
									AND c.merge_source IS DISTINCT FROM 'decision'
								RETURNING c.id, c.change_no,
									CASE WHEN prev.removed_at IS NULL THEN 'remove' ELSE 'change' END
										AS action
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

			const findByIds = SqlSchema.findAll({
				Request: Schema.Array(Schema.String),
				Result: CourseRow,
				execute: (ids) => sql`
					SELECT id, title, department_id AS "departmentId", level,
						removed_at IS NOT NULL AS removed, merged_into AS "mergedInto",
						merge_source AS "mergeSource"
					FROM courses
					WHERE id IN ${sql.in(ids)}
				`,
			});

			const decision = {};

			const decideMerge = (id: string, into: string) =>
				Effect.gen(function* () {
					yield* changes.track(
						"offerings",
						decision,
						sql`
							UPDATE offerings
							SET course_id = ${into}, course_source = 'decision',
								change_no = nextval('change_no_seq')
							WHERE course_id = ${id}
							RETURNING id, change_no, 'change' AS action
						`,
					);
					yield* changes.track(
						"courses",
						decision,
						sql`
							UPDATE courses
							SET removed_at = NULL, change_no = nextval('change_no_seq')
							WHERE id = ${into} AND removed_at IS NOT NULL
								AND EXISTS (
									SELECT 1 FROM offerings
									WHERE course_id = ${into} AND removed_at IS NULL
								)
							RETURNING id, change_no, 'restore' AS action
						`,
					);
					yield* changes.track(
						"courses",
						decision,
						sql`
							UPDATE courses c
							SET merged_into = ${into}, merge_source = 'decision',
								removed_at = coalesce(c.removed_at, now()),
								change_no = nextval('change_no_seq')
							FROM courses prev
							WHERE c.id = ${id} AND prev.id = c.id
							RETURNING c.id, c.change_no,
								CASE WHEN prev.removed_at IS NULL THEN 'remove' ELSE 'change' END
									AS action
						`,
					);
				});

			const decideUnmerge = (id: string) =>
				Effect.gen(function* () {
					yield* changes.track(
						"offerings",
						decision,
						sql`
							WITH RECURSIVE chain AS (
								SELECT merged_into AS id FROM courses WHERE id = ${id}
								UNION
								SELECT c.merged_into FROM courses c JOIN chain ON c.id = chain.id
								WHERE c.merged_into IS NOT NULL
							)
							UPDATE offerings o
							SET course_id = k.id, course_source = 'decision',
								change_no = nextval('change_no_seq')
							FROM courses k
							WHERE k.id = ${id} AND o.course_id IN (SELECT id FROM chain)
								AND (o.title, o.department_id, o.level)
									IS NOT DISTINCT FROM (k.title, k.department_id, k.level)
							RETURNING o.id, o.change_no, 'change' AS action
						`,
					);
					yield* changes.track(
						"courses",
						decision,
						sql`
							UPDATE courses
							SET merged_into = NULL, merge_source = NULL, removed_at = NULL,
								change_no = nextval('change_no_seq')
							WHERE id = ${id}
							RETURNING id, change_no, 'restore' AS action
						`,
					);
				});

			return CourseStore.of({
				liveOfferings: findLiveOfferings().pipe(Effect.orDie),
				courses: findCourses().pipe(Effect.orDie),
				open,
				link,
				find: (ids) => findByIds(ids).pipe(Effect.orDie),
				decideMerge,
				decideUnmerge,
			});
		}),
	);
}
