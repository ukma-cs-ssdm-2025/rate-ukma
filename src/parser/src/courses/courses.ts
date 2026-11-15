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
	readonly academicYear: number;
	readonly courseId: string | null;
	/** `decision` keeps the course a staff decision gave (rule 10). */
	readonly courseSource: "rule" | "decision" | null;
}

export interface StoredCourse extends CourseKey {
	readonly id: string;
	readonly removed: boolean;
	readonly mergedInto: string | null;
	/** `rule` for a department handoff, `decision` for a staff merge. */
	readonly mergeSource: "rule" | "decision" | null;
}

export interface OfferingLink {
	readonly offeringId: string;
	readonly courseId: string;
}

export interface CourseMerge {
	readonly courseId: string;
	readonly into: string;
}

const keyOf = ({ title, departmentId, level }: CourseKey) =>
	JSON.stringify([title, departmentId, level]);

const ruled = (offerings: ReadonlyArray<LiveOffering>) =>
	offerings.filter(({ courseSource }) => courseSource !== "decision");

/** Department handoff: a title and level whose last year under one
 *  department is right before its first year under another, with no gap and
 *  no overlap, is one course that moved. Each key maps to the last key of its
 *  chain (A, then B, then C), so the course keeps the latest department. A
 *  handoff counts only when it is the one way on from its key and the one way
 *  in to the next, so two departments taking a title over at once stay
 *  apart. Offerings a decision holds neither make nor break a handoff. */
const handoffTargets = (offerings: ReadonlyArray<LiveOffering>) => {
	interface Span {
		readonly course: CourseKey;
		readonly first: number;
		readonly last: number;
	}

	const spans = new Map<string, Span>();

	for (const { title, departmentId, level, academicYear } of ruled(offerings)) {
		if (departmentId === null) continue;

		const course = { title, departmentId, level };
		const span = spans.get(keyOf(course));

		spans.set(keyOf(course), {
			course,
			first: Math.min(span?.first ?? academicYear, academicYear),
			last: Math.max(span?.last ?? academicYear, academicYear),
		});
	}

	const byTitle = new Map<string, Array<Span>>();

	for (const span of spans.values()) {
		const title = JSON.stringify([span.course.title, span.course.level]);
		const bucket = byTitle.get(title);

		if (bucket === undefined) byTitle.set(title, [span]);
		else bucket.push(span);
	}

	const next = new Map<string, Array<string>>();
	const previous = new Map<string, Array<string>>();

	for (const bucket of byTitle.values()) {
		for (const from of bucket) {
			for (const to of bucket) {
				if (from.last + 1 !== to.first) continue;

				const fromKey = keyOf(from.course);
				const toKey = keyOf(to.course);

				next.set(fromKey, [...(next.get(fromKey) ?? []), toKey]);
				previous.set(toKey, [...(previous.get(toKey) ?? []), fromKey]);
			}
		}
	}

	const step = (key: string) => {
		const [to, ...more] = next.get(key) ?? [];

		return to !== undefined &&
			more.length === 0 &&
			previous.get(to)?.length === 1
			? to
			: undefined;
	};

	return (course: CourseKey): CourseKey => {
		let key = keyOf(course);

		for (let to = step(key); to !== undefined; to = step(key)) key = to;

		return spans.get(key)?.course ?? course;
	};
};

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
 *  offerings again comes back, so its id stays. A key handed off to another
 *  department gets a course too, unless one was merged already, so the merge
 *  shows in `merged_into` even on a first grouping. A course the rule merged
 *  whose handoff no longer holds, while its key has live offerings, is
 *  unmerged and takes them back; a staff merge never is. A removed course a
 *  decision holds a live offering in comes back too. */
export const planCourses = (
	offerings: ReadonlyArray<LiveOffering>,
	courses: ReadonlyArray<StoredCourse>,
) => {
	const targetOf = handoffTargets(offerings);

	const standing = new Set(
		ruled(offerings).flatMap((offering) =>
			keyOf(targetOf(offering)) === keyOf(offering) ? [keyOf(offering)] : [],
		),
	);

	const held = courseByKey(courses);
	const unmerge = new Map<string, string>();

	for (const course of courses) {
		const key = keyOf(course);

		if (
			course.mergeSource === "rule" &&
			standing.has(key) &&
			!held.has(key) &&
			!unmerge.has(key)
		) {
			unmerge.set(key, course.id);
		}
	}

	const unmerged = new Set(unmerge.values());

	const byKey = courseByKey(
		courses.map((course) =>
			unmerged.has(course.id)
				? { ...course, removed: false, mergedInto: null, mergeSource: null }
				: course,
		),
	);

	const mergedKeys = new Set(
		courses.flatMap((course) =>
			course.mergedInto === null ? [] : [keyOf(course)],
		),
	);

	const add = new Map<string, CourseKey>();
	const restore = new Set<string>();

	for (const { title, departmentId, level } of ruled(offerings)) {
		const own = keyOf({ title, departmentId, level });
		const target = targetOf({ title, departmentId, level });
		const course = byKey.get(keyOf(target));

		if (course === undefined) add.set(keyOf(target), target);
		else if (course.removed) restore.add(course.id);

		if (keyOf(target) !== own && !byKey.has(own) && !mergedKeys.has(own)) {
			add.set(own, { title, departmentId, level });
		}
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

	return {
		add: [...add.values()],
		restore: [...restore],
		unmerge: [...unmerged],
	};
};

/** Each ruled offering's link, where it differs from the stored one; the
 *  courses no offering is left in whose key was handed off, merged into the
 *  course that took it over; and the other live courses no live offering is
 *  left in. */
export const planLinks = (
	offerings: ReadonlyArray<LiveOffering>,
	courses: ReadonlyArray<StoredCourse>,
) => {
	const byKey = courseByKey(courses);
	const targetOf = handoffTargets(offerings);
	const links: Array<OfferingLink> = [];
	const used = new Set<string>();

	for (const offering of offerings) {
		const courseId =
			offering.courseSource === "decision"
				? offering.courseId
				: (byKey.get(keyOf(targetOf(offering)))?.id ?? null);

		if (courseId === null) continue;

		used.add(courseId);

		if (courseId !== offering.courseId) {
			links.push({ offeringId: offering.id, courseId });
		}
	}

	const merge: Array<CourseMerge> = [];
	const remove: Array<string> = [];

	for (const course of courses) {
		if (course.mergedInto !== null || used.has(course.id)) continue;

		const target = keyOf(targetOf(course));
		const into = target === keyOf(course) ? undefined : byKey.get(target);

		if (into !== undefined) merge.push({ courseId: course.id, into: into.id });
		else if (!course.removed) remove.push(course.id);
	}

	return { links, merge, remove };
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

			const { add, restore, unmerge } = planCourses(
				offerings,
				yield* store.courses,
			);

			yield* store.open(source, add, restore, unmerge);

			const { links, merge, remove } = planLinks(
				offerings,
				yield* store.courses,
			);

			yield* store.link(source, links, merge, remove);

			return {
				added: add.length,
				restored: restore.length,
				unmerged: unmerge.length,
				moved: links.length,
				merged: merge.length,
				removed: remove.length,
			};
		}),
	);
});
