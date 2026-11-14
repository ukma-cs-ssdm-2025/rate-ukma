import { Effect } from "effect";
import { ChangeLog, type ChangeSource } from "../changes/ChangeLog.ts";
import type { ParsedOffering } from "../saz/coursePage.ts";
import { CourseStore } from "./CourseStore.ts";

/** What the course rule groups by: same title, same department (a missing one
 *  is a value of its own, B18) and same level (C2). By department, not
 *  faculty, so a faculty reorganisation moves no offering (C4). */
export interface CourseKey {
	readonly title: string;
	readonly departmentId: string | null;
	readonly level: ParsedOffering["level"];
}

export interface LiveOffering extends CourseKey {
	readonly id: string;
	readonly courseId: string | null;
	/** `decision` keeps the course a staff decision gave (rule 10). */
	readonly courseSource: "rule" | "decision" | null;
}

export interface StoredCourse extends CourseKey {
	readonly id: string;
	readonly removed: boolean;
	readonly mergedInto: string | null;
}

export interface OfferingLink {
	readonly offeringId: string;
	readonly courseId: string;
}

const keyOf = ({ title, departmentId, level }: CourseKey) =>
	JSON.stringify([title, departmentId, level]);

const ruled = (offerings: ReadonlyArray<LiveOffering>) =>
	offerings.filter(({ courseSource }) => courseSource !== "decision");

/** The course each key's offerings join: a merged course is never one, a live
 *  course wins over a removed one, then the oldest (ids are UUIDv7). */
const courseByKey = (courses: ReadonlyArray<StoredCourse>) => {
	const byKey = new Map<string, StoredCourse>();

	for (const course of courses) {
		if (course.mergedInto !== null) continue;

		const key = keyOf(course);
		const held = byKey.get(key);

		if (
			held === undefined ||
			(held.removed && !course.removed) ||
			(held.removed === course.removed && course.id < held.id)
		) {
			byKey.set(key, course);
		}
	}

	return byKey;
};

/** The courses the rule needs before offerings can link to them: a key no
 *  course holds gets a new course; a removed course whose key has live
 *  offerings again comes back, so its id stays. A removed course a decision
 *  holds a live offering in comes back too. */
export const planCourses = (
	offerings: ReadonlyArray<LiveOffering>,
	courses: ReadonlyArray<StoredCourse>,
) => {
	const byKey = courseByKey(courses);
	const add = new Map<string, CourseKey>();
	const restore = new Set<string>();

	for (const { title, departmentId, level } of ruled(offerings)) {
		const key = keyOf({ title, departmentId, level });
		const course = byKey.get(key);

		if (course === undefined) add.set(key, { title, departmentId, level });
		else if (course.removed) restore.add(course.id);
	}

	const byId = new Map(courses.map((course) => [course.id, course]));

	for (const { courseId, courseSource } of offerings) {
		const course = courseId === null ? undefined : byId.get(courseId);

		if (
			courseSource === "decision" &&
			course?.removed === true &&
			course.mergedInto === null
		) {
			restore.add(course.id);
		}
	}

	return { add: [...add.values()], restore: [...restore] };
};

/** Each ruled offering's link, where it differs from the stored one, and the
 *  live courses no live offering is left in. */
export const planLinks = (
	offerings: ReadonlyArray<LiveOffering>,
	courses: ReadonlyArray<StoredCourse>,
) => {
	const byKey = courseByKey(courses);
	const links: Array<OfferingLink> = [];
	const used = new Set<string>();

	for (const offering of offerings) {
		const courseId =
			offering.courseSource === "decision"
				? offering.courseId
				: (byKey.get(keyOf(offering))?.id ?? null);

		if (courseId === null) continue;

		used.add(courseId);

		if (courseId !== offering.courseId) {
			links.push({ offeringId: offering.id, courseId });
		}
	}

	return {
		links,
		remove: courses.flatMap(({ id, removed, mergedInto }) =>
			!removed && mergedInto === null && !used.has(id) ? [id] : [],
		),
	};
};

/** Groups the live offerings into courses by the course rule, in one writers'
 *  turn. Ids stay: a course is found by its key, and only a new key, a moved
 *  offering or an emptied course takes a change number. An offering that is
 *  removed keeps the course it had. */
export const groupCourses = Effect.fn("groupCourses")(function* (
	source: ChangeSource,
) {
	const store = yield* CourseStore;
	const changes = yield* ChangeLog;

	return yield* changes.withTurn(
		Effect.gen(function* () {
			const offerings = yield* store.liveOfferings;
			const { add, restore } = planCourses(offerings, yield* store.courses);

			yield* store.open(source, add, restore);

			const { links, remove } = planLinks(offerings, yield* store.courses);

			yield* store.link(source, links, remove);

			return {
				added: add.length,
				restored: restore.length,
				moved: links.length,
				removed: remove.length,
			};
		}),
	);
});
