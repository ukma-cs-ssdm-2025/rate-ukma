import { Console, Effect, type Layer } from "effect";
import { Argument, Command, Flag } from "effect/cli";
import type { Audit } from "../audit/Audit.ts";
import { type ChangeCount, ChangeLog } from "../changes/ChangeLog.ts";
import { DRY_RUN, fail } from "../cli/output.ts";
import type { StoredCourse } from "./courses.ts";
import { CourseStore } from "./CourseStore.ts";
import {
	type CourseDecisionRefused,
	type CourseNotFound,
	merge,
	mergeCourse,
	unmerge,
	unmergeCourse,
} from "./decisions.ts";

interface CourseState {
	readonly course: StoredCourse;
	readonly liveOfferings: number;
}

/** Every course with its live offering count, inside the writers' turn. */
// oxlint-disable-next-line anti-slop-effect/require-named-effect-fn -- the CourseStore spans cover both reads.
const courseStates = Effect.fnUntraced(function* () {
	const store = yield* CourseStore;
	const offerings = yield* store.liveOfferings;
	const counts = new Map<string, number>();

	for (const { courseId } of offerings) {
		if (courseId !== null)
			counts.set(courseId, (counts.get(courseId) ?? 0) + 1);
	}

	return new Map(
		(yield* store.courses).map((course): [string, CourseState] => [
			course.id,
			{ course, liveOfferings: counts.get(course.id) ?? 0 },
		]),
	);
});

const shown = (value: string | null) => value ?? "none";

/** One line per course the write changed, each field old -> new. */
export const describeCourseChanges = (
	before: ReadonlyMap<string, CourseState>,
	after: ReadonlyMap<string, CourseState>,
): ReadonlyArray<string> =>
	[...after.values()].flatMap(({ course, liveOfferings }) => {
		const old = before.get(course.id);

		const fields = [
			[
				"merged_into",
				shown(old?.course.mergedInto ?? null),
				shown(course.mergedInto),
			],
			[
				"merge_source",
				shown(old?.course.mergeSource ?? null),
				shown(course.mergeSource),
			],
			[
				"removed",
				old?.course.removed ? "yes" : "no",
				course.removed ? "yes" : "no",
			],
			[
				"live offerings",
				String(old?.liveOfferings ?? 0),
				String(liveOfferings),
			],
		].flatMap(([field, from, to]) =>
			from === to ? [] : [`${field} ${from} -> ${to}`],
		);

		return fields.length === 0
			? []
			: [
					`course ${course.id} "${course.title}" (${course.level}): ${fields.join("; ")}`,
				];
	});

const describeWritten = (written: ReadonlyArray<ChangeCount>) =>
	written.map(({ table, action, rows }) => `${table}: ${rows} ${action}`);

const REFUSALS: Record<CourseDecisionRefused["reason"], string> = {
	same_course: "a course cannot merge into itself",
	course_merged: "the course is already merged; unmerge it first",
	target_merged:
		"the target is merged into another course; merge into that one",
	level_mismatch: "the two courses have different levels",
	not_merged: "the course is not merged",
};

/** One line for each failure `courses merge` and `courses unmerge` act on. */
const courseFailures = {
	CourseNotFound: ({ courseId }: CourseNotFound) =>
		fail(`No course ${courseId}`),
	CourseDecisionRefused: ({ reason }: CourseDecisionRefused) =>
		fail(`Refused (${reason}): ${REFUSALS[reason]}`),
};

/** Rehearses the write and prints what it would change, or runs it with --yes. */
const decide = Effect.fn("Courses.decide")(function* <E, R, C>(
	rehearsed: Effect.Effect<void, E, R>,
	commit: Effect.Effect<void, E, C>,
	done: string,
	yes: boolean,
) {
	if (yes) {
		yield* commit;
		yield* Console.log(done);

		return;
	}

	const changes = yield* ChangeLog;

	const { result, written } = yield* changes.rehearse(
		Effect.gen(function* () {
			const before = yield* courseStates();

			yield* rehearsed;

			return describeCourseChanges(before, yield* courseStates());
		}),
	);

	yield* Console.log("Would change:");

	for (const line of result) yield* Console.log(`\t${line}`);
	yield* Console.log("Rows written:");

	for (const line of describeWritten(written)) yield* Console.log(`\t${line}`);
	yield* Console.log("Audit: recorded with no key, as the command line");
	yield* Console.log(DRY_RUN);
});

const courseId = Argument.String("id").pipe(
	Argument.withDescription("The course id"),
);

const yesFlag = Flag.Boolean("yes").pipe(
	Flag.withDescription("Write the decision; without it, a dry run"),
	Flag.withDefault(false),
);

const mergeCommand = Command.make(
	"merge",
	{
		id: courseId,
		into: Flag.String("into").pipe(
			Flag.withDescription("The course of the same level to merge into"),
		),
		yes: yesFlag,
	},
	({ id, into, yes }) =>
		decide(
			merge(null, id, into),
			mergeCourse(null, id, into),
			`Merged course ${id} into ${into}`,
			yes,
		).pipe(
			Effect.catchTags(courseFailures),
			Effect.withSpan("Courses.mergeCommand"),
		),
).pipe(
	Command.withDescription(
		"Merge a course into another of the same level; a dry run unless --yes",
	),
);

const unmergeCommand = Command.make(
	"unmerge",
	{ id: courseId, yes: yesFlag },
	({ id, yes }) =>
		decide(
			unmerge(null, id),
			unmergeCourse(null, id),
			`Unmerged course ${id}`,
			yes,
		).pipe(
			Effect.catchTags(courseFailures),
			Effect.withSpan("Courses.unmergeCommand"),
		),
).pipe(
	Command.withDescription("Undo a course's merge; a dry run unless --yes"),
);

/** `courses merge|unmerge` with their services from `services`. */
export const courseCommands = <E, R>(
	services: Layer.Layer<CourseStore | ChangeLog | Audit, E, R>,
) =>
	Command.make("courses").pipe(
		Command.withDescription("Staff decisions on courses"),
		Command.withSubcommands([mergeCommand, unmergeCommand]),
		Command.provide(services),
	);
