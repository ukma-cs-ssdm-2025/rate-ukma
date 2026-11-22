import { Effect, Schema } from "effect";
import { Audit } from "../audit/Audit.ts";
import { ChangeLog } from "../changes/ChangeLog.ts";
import { CourseStore } from "./CourseStore.ts";

export class CourseNotFound extends Schema.TaggedError<CourseNotFound>()(
	"CourseNotFound",
	{ courseId: Schema.String },
	{ httpApiStatus: 404 },
) {}

/** A staff merge or unmerge that would leave the courses inconsistent. */
export class CourseDecisionRefused extends Schema.TaggedError<CourseDecisionRefused>()(
	"CourseDecisionRefused",
	{
		reason: Schema.Literals([
			"same_course",
			"course_merged",
			"target_merged",
			"level_mismatch",
			"not_merged",
		]),
	},
	{ httpApiStatus: 409 },
) {}

const refuse = (reason: CourseDecisionRefused["reason"]) =>
	Effect.fail(new CourseDecisionRefused({ reason }));

/** Merges a course into another of the same level, inside the writers'
 *  turn: `mergeCourse` commits it, the CLI's dry run rehearses it. */
export const merge = Effect.fn("Courses.merge")(function* (
	keyId: string | null,
	id: string,
	into: string,
) {
	const store = yield* CourseStore;
	const audit = yield* Audit;
	const found = yield* store.find([id, into]);
	const course = found.find((row) => row.id === id);
	const target = found.find((row) => row.id === into);

	if (course === undefined) {
		return yield* new CourseNotFound({ courseId: id });
	}

	if (target === undefined) {
		return yield* new CourseNotFound({ courseId: into });
	}

	const refused =
		id === into
			? "same_course"
			: course.mergedInto !== null
				? "course_merged"
				: target.mergedInto !== null
					? "target_merged"
					: course.level !== target.level
						? "level_mismatch"
						: undefined;

	if (refused !== undefined) return yield* refuse(refused);

	yield* store.decideMerge(id, into);
	yield* audit.record({
		action: "course_merged",
		keyId,
		targetId: id,
		relatedId: into,
	});
});

/** A staff decision to merge a course into another of the same level. Its
 *  offerings move there with `course_source` `decision`, so the course rule
 *  keeps them, and the course gets `merged_into` with `merge_source`
 *  `decision`, which the rule never undoes. `keyId` is null from the CLI. */
export const mergeCourse = Effect.fn("Courses.mergeCourse")(function* (
	keyId: string | null,
	id: string,
	into: string,
) {
	const changes = yield* ChangeLog;

	return yield* changes.withTurn(merge(keyId, id, into));
});

/** Undoes a course's merge inside the writers' turn, like `merge`. */
export const unmerge = Effect.fn("Courses.unmerge")(function* (
	keyId: string | null,
	id: string,
) {
	const store = yield* CourseStore;
	const audit = yield* Audit;
	const [course] = yield* store.find([id]);

	if (course === undefined) {
		return yield* new CourseNotFound({ courseId: id });
	}

	if (course.mergedInto === null) return yield* refuse("not_merged");

	yield* store.decideUnmerge(id);
	yield* audit.record({ action: "course_unmerged", keyId, targetId: id });
});

/** A staff decision to undo a course's merge, the rule's or staff's: the
 *  course comes back and takes back its key's offerings, held by the
 *  decision, so the rule does not merge it again. */
export const unmergeCourse = Effect.fn("Courses.unmergeCourse")(function* (
	keyId: string | null,
	id: string,
) {
	const changes = yield* ChangeLog;

	return yield* changes.withTurn(unmerge(keyId, id));
});
