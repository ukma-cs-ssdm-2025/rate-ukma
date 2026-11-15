import { assert, describe, it, layer } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { SqlClient } from "effect/sql";
import { ChangeLog } from "../changes/ChangeLog.ts";
import { TestDatabase, testDatabaseUrl } from "../db/testing.ts";
import { offering } from "../offerings/offering.fixture.ts";
import { offeringRowsOf } from "../offerings/offerings.ts";
import { OfferingStore } from "../offerings/OfferingStore.ts";
import { NO_FILTERS, reset, snapshot } from "../offerings/testing.ts";
import type { ParsedOffering } from "../saz/coursePage.ts";
import {
	groupCourses,
	type LiveOffering,
	planCases,
	planCourses,
	planLinks,
	type StoredCourse,
} from "./courses.ts";
import { CourseStore } from "./CourseStore.ts";

const live = (id: string, patch: Partial<LiveOffering> = {}): LiveOffering => ({
	id,
	academicYear: 2031,
	title: "Вигадана алгебра",
	departmentId: "dep_a",
	level: "bachelor",
	courseId: null,
	courseSource: null,
	...patch,
});

const course = (
	id: string,
	patch: Partial<StoredCourse> = {},
): StoredCourse => ({
	id,
	title: "Вигадана алгебра",
	departmentId: "dep_a",
	level: "bachelor",
	removed: false,
	mergedInto: null,
	...patch,
});

describe("planCourses", () => {
	it("adds one course per title, department and level", () => {
		const { add } = planCourses(
			[
				live("off_1"),
				live("off_2"),
				live("off_3", { level: "master" }),
				live("off_4", { departmentId: null }),
				live("off_5", { departmentId: null }),
				live("off_6", { departmentId: "dep_b" }),
				live("off_7", { title: "Вигадана алгебра (англ. мовою)" }),
				live("off_8", { title: "вигадана алгебра" }),
			],
			[],
		);

		assert.deepStrictEqual(
			add.map(({ title, departmentId, level }) =>
				[title, departmentId, level].join(" | "),
			),
			[
				"Вигадана алгебра | dep_a | bachelor",
				"Вигадана алгебра | dep_a | master",
				"Вигадана алгебра |  | bachelor",
				"Вигадана алгебра | dep_b | bachelor",
				"Вигадана алгебра (англ. мовою) | dep_a | bachelor",
				"вигадана алгебра | dep_a | bachelor",
			],
		);
	});

	it("restores a removed course of the key, skips merged ones and decided offerings", () => {
		assert.deepStrictEqual(
			planCourses(
				[
					live("off_1"),
					live("off_2", { title: "Інше", courseSource: "decision" }),
				],
				[
					course("crs_1", { mergedInto: "crs_9" }),
					course("crs_2", { removed: true }),
				],
			),
			{ add: [], restore: ["crs_2"] },
		);
	});

	it("restores the removed course a decision holds a live offering in", () => {
		assert.deepStrictEqual(
			planCourses(
				[
					live("off_1", {
						title: "Інше",
						courseId: "crs_3",
						courseSource: "decision",
					}),
					live("off_2", { courseId: "crs_4", courseSource: "decision" }),
				],
				[
					course("crs_1"),
					course("crs_3", { title: "Ще інше", removed: true }),
					course("crs_4", { removed: true, mergedInto: "crs_1" }),
				],
			).restore,
			["crs_3"],
		);
	});
});

describe("planLinks", () => {
	it("links to the oldest live course of the key and removes the emptied ones", () => {
		assert.deepStrictEqual(
			planLinks(
				[
					live("off_1", { courseId: "crs_3" }),
					live("off_2", { courseId: "crs_2" }),
					live("off_3", { courseId: "crs_4", courseSource: "decision" }),
				],
				[
					course("crs_2"),
					course("crs_3", { departmentId: "dep_b" }),
					course("crs_4", { title: "Інше" }),
					course("crs_5"),
				],
			),
			{
				links: [{ offeringId: "off_1", courseId: "crs_2" }],
				remove: ["crs_3", "crs_5"],
			},
		);
	});
});

describe("planCases", () => {
	const answers = (
		offerings: ReadonlyArray<LiveOffering>,
		courses: ReadonlyArray<StoredCourse>,
	) =>
		planCases(offerings, courses).map(
			({ subjectId, courseIds, answer }) =>
				`${subjectId}: ${courseIds.join(" ")} ${answer}`,
		);

	it("keeps apart one title under two departments whose years never overlap", () => {
		assert.deepStrictEqual(
			answers(
				[
					live("off_1", { courseId: "crs_1" }),
					live("off_2", { courseId: "crs_2", academicYear: 2032 }),
					live("off_3", { courseId: "crs_3", academicYear: 2032 }),
					live("off_4", { courseId: "crs_4", academicYear: 2033 }),
				],
				[
					course("crs_1"),
					course("crs_2", { departmentId: "dep_b" }),
					course("crs_3", { departmentId: "dep_c" }),
					course("crs_4", { departmentId: null }),
					course("crs_5", { departmentId: "dep_d", removed: true }),
					course("crs_6", { departmentId: "dep_e", mergedInto: "crs_1" }),
					course("crs_7", { departmentId: "dep_f" }),
				],
			),
			["crs_2: crs_1 crs_2 keep_apart", "crs_3: crs_1 crs_3 keep_apart"],
		);
	});

	it("keeps apart titles that differ by letter case, spaces or a bracket note", () => {
		assert.deepStrictEqual(
			answers(
				["crs_1", "crs_2", "crs_3", "crs_4", "crs_5"].map((courseId, i) =>
					live(`off_${i}`, { courseId }),
				),
				[
					course("crs_1"),
					course("crs_2", { title: "вигадана  алгебра" }),
					course("crs_3", { title: "Вигадана алгебра (англ. мовою)" }),
					course("crs_4", { title: "Вигадана алгебра", level: "master" }),
					course("crs_5", { title: "Вигадана алгебра 2" }),
				],
			),
			[
				"crs_2: crs_1 crs_2 keep_apart",
				"crs_3: crs_1 crs_3 keep_apart",
				"crs_3: crs_2 crs_3 keep_apart",
			],
		);
	});

	it("asks to split a generic title's course of two or more offerings", () => {
		const departments = ["dep_a", "dep_b", "dep_c", "dep_d", "dep_e"];
		const generic = { title: "Вигадана робота" };

		assert.deepStrictEqual(
			answers(
				[
					live("off_0", { ...generic, courseId: "crs_1", academicYear: 2032 }),
					...departments.map((_, i) =>
						live(`off_${i + 1}`, { ...generic, courseId: `crs_${i + 1}` }),
					),
				],
				departments.map((departmentId, i) =>
					course(`crs_${i + 1}`, { ...generic, departmentId }),
				),
			),
			["crs_1: crs_1 keep_merged"],
		);
	});
});

const TestLive = Layer.mergeAll(CourseStore.layer, OfferingStore.layer).pipe(
	Layer.provideMerge(ChangeLog.layer),
	Layer.provideMerge(TestDatabase(testDatabaseUrl)),
);

/** Writes these offerings as a parse would, each from a new snapshot. */
const write = (offerings: ReadonlyArray<ParsedOffering>) =>
	Effect.gen(function* () {
		const store = yield* OfferingStore;

		const pages = yield* Effect.forEach(offerings, (parsed) =>
			snapshot(
				`/course/${parsed.sazCode}`,
				`${parsed.title} ${parsed.department}`,
			).pipe(Effect.map((snapshotId) => ({ snapshotId, offering: parsed }))),
		);

		yield* store.write(
			offeringRowsOf(pages, NO_FILTERS, yield* store.programmes),
			yield* store.startParse("crawl"),
		);
	});

interface Grouped {
	readonly sazCode: string;
	readonly courseId: string;
	readonly courseSource: string;
	readonly changeNo: bigint;
}

const groups = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;

	return yield* sql<Grouped>`
		SELECT saz_code AS "sazCode", course_id AS "courseId",
			course_source AS "courseSource", change_no AS "changeNo"
		FROM offerings ORDER BY saz_code
	`;
});

const courses = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;

	return yield* sql<{
		readonly id: string;
		readonly removed: boolean;
		readonly changeNo: bigint;
	}>`
		SELECT id, removed_at IS NOT NULL AS removed, change_no AS "changeNo"
		FROM courses ORDER BY id
	`;
});

const lastChange = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;

	const [row] = yield* sql<{ readonly n: bigint | null }>`
		SELECT max(change_no) AS n FROM changes
	`;

	return row?.n;
});

const reviewCases = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;

	return yield* sql<{
		readonly subjectId: string;
		readonly candidates: { readonly courseIds: ReadonlyArray<string> };
		readonly safeAnswer: unknown;
		readonly status: string;
		readonly changeNo: bigint;
	}>`
		SELECT subject_id AS "subjectId", candidates, safe_answer AS "safeAnswer",
			status, change_no AS "changeNo"
		FROM review_cases WHERE kind = 'course_match' ORDER BY change_no
	`;
});

const noUnit = { faculty: null, department: null };

const otherDepartment = { department: "Кафедра вигаданої логіки" };

describe("groupCourses", () => {
	layer(TestLive, { timeout: 30_000, excludeTestServices: true })((it) => {
		it.effect("groups offerings by title, department and level", () =>
			Effect.gen(function* () {
				yield* reset;

				yield* write([
					offering("900001", { academicYear: 2031 }),
					offering("900002", { academicYear: 2032 }),
					offering("900003", { academicYear: 2032 }),
					offering("900004", { level: "master" }),
					offering("900005", { ...noUnit, level: "master" }),
					offering("900006", {
						...noUnit,
						level: "master",
						academicYear: 2032,
					}),
					offering("900007", {
						title: "Вступ до вигаданих систем (англ. мовою)",
					}),
				]);

				yield* groupCourses({});

				const rows = yield* groups;

				const courseOf = new Map(
					rows.map((row) => [row.sazCode, row.courseId]),
				);

				assert.deepStrictEqual(
					rows.map(({ courseSource }) => courseSource),
					Array(7).fill("rule"),
				);
				assert.strictEqual(courseOf.get("900002"), courseOf.get("900001"));
				assert.strictEqual(courseOf.get("900003"), courseOf.get("900001"));
				assert.strictEqual(courseOf.get("900006"), courseOf.get("900005"));
				assert.strictEqual(new Set(courseOf.values()).size, 4);
				assert.strictEqual((yield* courses).length, 4);
			}),
		);

		it.effect("changes nothing when grouping again", () =>
			Effect.gen(function* () {
				yield* reset;

				yield* write([
					offering("900011"),
					offering("900012", { level: "master" }),
					offering("900013", { ...otherDepartment, academicYear: 2032 }),
				]);
				assert.deepInclude(yield* groupCourses({}), {
					cases: { opened: 1, closed: 0 },
				});

				const state = Effect.all({ groups, courses, reviewCases });
				const before = yield* state;
				const last = yield* lastChange;

				assert.deepStrictEqual(yield* groupCourses({}), {
					added: 0,
					restored: 0,
					moved: 0,
					removed: 0,
					cases: { opened: 0, closed: 0 },
				});
				assert.deepStrictEqual(yield* state, before);
				assert.strictEqual(yield* lastChange, last);
			}),
		);

		it.effect(
			"moves an offering whose department changed, removes the emptied course and restores it",
			() =>
				Effect.gen(function* () {
					yield* reset;

					yield* write([
						offering("900021"),
						offering("900022", { academicYear: 2032 }),
					]);
					yield* groupCourses({});

					const [first] = yield* courses;

					yield* write([
						offering("900021", { department: "Кафедра вигаданої логіки" }),
						offering("900022", {
							academicYear: 2032,
							department: "Кафедра вигаданої логіки",
						}),
					]);

					assert.deepInclude(yield* groupCourses({}), {
						added: 1,
						moved: 2,
						removed: 1,
					});

					const moved = yield* groups;

					assert.notStrictEqual(moved[0]?.courseId, first?.id);
					assert.deepInclude(
						(yield* courses).find(({ id }) => id === first?.id),
						{
							removed: true,
						},
					);

					yield* write([
						offering("900021"),
						offering("900022", { academicYear: 2032 }),
					]);

					assert.deepInclude(yield* groupCourses({}), {
						added: 0,
						restored: 1,
						moved: 2,
						removed: 1,
					});
					assert.deepStrictEqual(
						(yield* groups).map(({ courseId }) => courseId),
						[first?.id, first?.id],
					);
				}),
		);

		it.effect(
			"opens a case for a moved department and makes it obsolete when a course is removed",
			() =>
				Effect.gen(function* () {
					yield* reset;

					yield* write([
						offering("900031"),
						offering("900032", { ...otherDepartment, academicYear: 2032 }),
						offering("900033", { title: "вступ до  вигаданих систем" }),
						offering("900034", {
							...otherDepartment,
							title: "Інша вигадана тема",
						}),
					]);
					yield* groupCourses({});

					const courseOf = new Map(
						(yield* groups).map((row) => [row.sazCode, row.courseId]),
					);

					const first = courseOf.get("900031");
					const moved = courseOf.get("900032");
					const folded = courseOf.get("900033");

					const sorted = (...ids: Array<string | undefined>) =>
						ids.map(String).sort();

					assert.sameDeepMembers(
						(yield* reviewCases).map(
							({ subjectId, candidates, safeAnswer, status }) => ({
								subjectId,
								candidates,
								safeAnswer,
								status,
							}),
						),
						[
							{
								subjectId: sorted(first, moved)[1],
								candidates: { courseIds: sorted(first, moved) },
								safeAnswer: { answer: "keep_apart" },
								status: "open",
							},
							{
								subjectId: sorted(first, folded)[1],
								candidates: { courseIds: sorted(first, folded) },
								safeAnswer: { answer: "keep_apart" },
								status: "open",
							},
						],
					);

					// The moved course's only offering moves into the first one's year,
					// so the years overlap: no longer a move.
					yield* write([offering("900032", otherDepartment)]);

					assert.deepInclude(yield* groupCourses({}), {
						cases: { opened: 0, closed: 1 },
					});

					// The folded title's course empties and is removed.
					yield* write([offering("900033")]);

					assert.deepInclude(yield* groupCourses({}), {
						removed: 1,
						cases: { opened: 0, closed: 1 },
					});
					assert.deepStrictEqual(
						(yield* reviewCases).map(({ status }) => status),
						["obsolete", "obsolete"],
					);
				}),
		);
	});
});
