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

/** A staff decision to merge a course into another of the same level. Its
 *  offerings move there with `course_source` `decision`, so the course rule
 *  keeps them, and the course gets `merged_into` with `merge_source`
 *  `decision`, which the rule never undoes. */
export const mergeCourse = Effect.fn("mergeCourse")(function* (
	keyId: string,
	id: string,
	into: string,
) {
	const store = yield* CourseStore;
	const changes = yield* ChangeLog;
	const audit = yield* Audit;

	return yield* changes.withTurn(
		Effect.gen(function* () {
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
		}),
	);
});

/** A staff decision to undo a course's merge, the rule's or staff's: the
 *  course comes back and takes back its key's offerings, held by the
 *  decision, so the rule does not merge it again. */
export const unmergeCourse = Effect.fn("unmergeCourse")(function* (
	keyId: string,
	id: string,
) {
	const store = yield* CourseStore;
	const changes = yield* ChangeLog;
	const audit = yield* Audit;

	return yield* changes.withTurn(
		Effect.gen(function* () {
			const [course] = yield* store.find([id]);

			if (course === undefined) {
				return yield* new CourseNotFound({ courseId: id });
			}

			if (course.mergedInto === null) return yield* refuse("not_merged");

			yield* store.decideUnmerge(id);
			yield* audit.record({ action: "course_unmerged", keyId, targetId: id });
		}),
	);
});
