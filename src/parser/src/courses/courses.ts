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
}

export interface OfferingLink {
	readonly offeringId: string;
	readonly courseId: string;
}

/** A `course_match` case: `courseIds` (sorted) are the courses it asks
 *  about, and `subjectId` the newest of them. Two courses kept apart, or one
 *  course the rule merged that staff may split. */
export interface CourseCase {
	readonly subjectId: string;
	readonly courseIds: ReadonlyArray<string>;
	readonly answer: "keep_apart" | "keep_merged";
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

/** A title used by this many departments at one level names a kind of work,
 *  not a subject: theses, coursework, exams, practice, guest courses. On
 *  staging data every title at 5 or more departments is one (19 titles); at 4
 *  real subjects such as an economics course start to appear. */
const GENERIC_DEPARTMENTS = 5;

/** The title without letter case, repeated spaces or a trailing bracket note
 *  such as "(англ. мовою)" (C3). */
const foldTitle = (title: string) =>
	title
		.replace(/\s*\([^()]*\)\s*$/u, "")
		.toLowerCase()
		.replace(/\s+/gu, " ")
		.trim();

const groupBy = <T>(items: ReadonlyArray<T>, key: (item: T) => string) => {
	const groups = new Map<string, Array<T>>();

	for (const item of items) {
		const k = key(item);
		const group = groups.get(k);

		if (group === undefined) groups.set(k, [item]);
		else group.push(item);
	}

	return groups.values();
};

/** The review cases the live courses call for, each with the rule's answer:
 *  - a course of a generic title with two or more offerings may mix
 *    subjects: kept merged;
 *  - two courses of one title and level under different departments, in years
 *    that never overlap, look like a moved department: kept apart. Overlapping
 *    years are two departments teaching it, so no case;
 *  - two courses of one department and level whose titles differ only by
 *    letter case, spaces or a trailing bracket note: kept apart. */
export const planCases = (
	offerings: ReadonlyArray<LiveOffering>,
	courses: ReadonlyArray<StoredCourse>,
) => {
	const years = new Map<string, Set<number>>();
	const sizes = new Map<string, number>();
	const departments = new Map<string, Set<string>>();

	for (const { courseId, academicYear } of offerings) {
		if (courseId === null) continue;
		years.set(courseId, (years.get(courseId) ?? new Set()).add(academicYear));
		sizes.set(courseId, (sizes.get(courseId) ?? 0) + 1);
	}

	// A course whose offerings were all just removed has no years; the next
	// grouping removes it.
	const live = courses.filter(
		({ id, removed, mergedInto }) =>
			!removed && mergedInto === null && years.has(id),
	);

	const titleKey = ({ title, level }: CourseKey) =>
		JSON.stringify([title, level]);

	for (const course of live) {
		if (course.departmentId === null) continue;
		const key = titleKey(course);
		departments.set(
			key,
			(departments.get(key) ?? new Set()).add(course.departmentId),
		);
	}

	const generic = (course: CourseKey) =>
		(departments.get(titleKey(course))?.size ?? 0) >= GENERIC_DEPARTMENTS;

	const cases: Array<CourseCase> = live.flatMap(({ id, ...key }) =>
		generic(key) && (sizes.get(id) ?? 0) >= 2
			? [{ subjectId: id, courseIds: [id], answer: "keep_merged" as const }]
			: [],
	);

	const pairs = (
		groups: Iterable<ReadonlyArray<StoredCourse>>,
		apart: (a: StoredCourse, b: StoredCourse) => boolean,
	) => {
		for (const group of groups) {
			const sorted = [...group].sort((a, b) => (a.id < b.id ? -1 : 1));

			sorted.forEach((a, i) => {
				for (const b of sorted.slice(i + 1)) {
					if (apart(a, b)) {
						cases.push({
							subjectId: b.id,
							courseIds: [a.id, b.id],
							answer: "keep_apart",
						});
					}
				}
			});
		}
	};

	pairs(
		groupBy(live, titleKey),
		(a, b) =>
			a.departmentId !== null &&
			b.departmentId !== null &&
			a.departmentId !== b.departmentId &&
			!generic(a) &&
			![...(years.get(a.id) ?? [])].some((year) => years.get(b.id)?.has(year)),
	);
	pairs(
		groupBy(live, ({ title, departmentId, level }) =>
			JSON.stringify([foldTitle(title), departmentId, level]),
		),
		(a, b) => a.title !== b.title,
	);

	return cases;
};

/** Groups the live offerings into courses by the course rule, in one writers'
 *  turn. Ids stay: a course is found by its key, and only a new key, a moved
 *  offering or an emptied course takes a change number. An offering that is
 *  removed keeps the course it had. Then it opens the review cases the courses
 *  call for and makes the open ones they no longer call for obsolete. */
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

			const cases = yield* store.review(
				source,
				planCases(yield* store.liveOfferings, yield* store.courses),
			);

			return {
				added: add.length,
				restored: restore.length,
				moved: links.length,
				removed: remove.length,
				cases,
			};
		}),
	);
});
