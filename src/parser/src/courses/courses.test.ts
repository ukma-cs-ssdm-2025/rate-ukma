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
	mergeSource: null,
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

	it("adds the course of a handoff and one to merge, unless that one was merged", () => {
		const offerings = [
			live("off_1"),
			live("off_2", { departmentId: "dep_b", academicYear: 2032 }),
		];

		assert.deepStrictEqual(
			planCourses(offerings, []).add.map(({ departmentId }) => departmentId),
			["dep_b", "dep_a"],
		);
		assert.deepStrictEqual(
			planCourses(offerings, [
				course("crs_1", {
					removed: true,
					mergedInto: "crs_2",
					mergeSource: "rule",
				}),
				course("crs_2", { departmentId: "dep_b" }),
			]),
			{ add: [], restore: [], unmerge: [] },
		);
	});

	it("undoes the rule's merge whose handoff no longer holds, never a staff one", () => {
		const merged = { removed: true, mergedInto: "crs_3" };

		assert.deepStrictEqual(
			planCourses(
				[
					live("off_1"),
					live("off_2", { departmentId: "dep_b" }),
					live("off_3", { title: "Інше" }),
					live("off_4", { title: "Інше", departmentId: "dep_b" }),
				],
				[
					course("crs_1", { ...merged, mergeSource: "rule" }),
					course("crs_2", {
						...merged,
						title: "Інше",
						mergeSource: "decision",
					}),
					course("crs_3", { departmentId: "dep_b" }),
					course("crs_4", { title: "Інше", departmentId: "dep_b" }),
				],
			),
			{
				add: [{ title: "Інше", departmentId: "dep_a", level: "bachelor" }],
				restore: [],
				unmerge: ["crs_1"],
			},
		);
	});

	it("undoes every rule merge of a key whose handoff no longer holds", () => {
		const merged = {
			removed: true,
			mergedInto: "crs_3",
			mergeSource: "rule",
		} as const;

		assert.deepStrictEqual(
			planCourses(
				[live("off_1"), live("off_2", { departmentId: "dep_b" })],
				[
					course("crs_1", merged),
					course("crs_2", merged),
					course("crs_3", { departmentId: "dep_b" }),
				],
			).unmerge,
			["crs_1", "crs_2"],
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
					course("crs_1", { mergedInto: "crs_9", mergeSource: "decision" }),
					course("crs_2", { removed: true }),
				],
			),
			{ add: [], restore: ["crs_2"], unmerge: [] },
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
					course("crs_4", {
						removed: true,
						mergedInto: "crs_1",
						mergeSource: "decision",
					}),
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
				merge: [],
				remove: ["crs_3", "crs_5"],
			},
		);
	});

	it("merges a department handoff into the latest department's course", () => {
		const other = { title: "Інше" };

		assert.deepStrictEqual(
			planLinks(
				[
					live("off_1", { courseId: "crs_1" }),
					live("off_2", { departmentId: "dep_b", academicYear: 2032 }),
					live("off_3", { departmentId: "dep_c", academicYear: 2033 }),
					live("off_4", { departmentId: "dep_c", academicYear: 2034 }),
					// A gap: kept apart.
					live("off_5", { ...other, courseId: "crs_5" }),
					live("off_6", {
						...other,
						departmentId: "dep_b",
						academicYear: 2033,
					}),
				],
				[
					course("crs_1"),
					course("crs_2", { departmentId: "dep_b" }),
					course("crs_3", { departmentId: "dep_c" }),
					course("crs_5", other),
					course("crs_6", { ...other, departmentId: "dep_b" }),
				],
			),
			{
				links: [
					{ offeringId: "off_1", courseId: "crs_3" },
					{ offeringId: "off_2", courseId: "crs_3" },
					{ offeringId: "off_3", courseId: "crs_3" },
					{ offeringId: "off_4", courseId: "crs_3" },
					{ offeringId: "off_6", courseId: "crs_6" },
				],
				merge: [
					{ courseId: "crs_1", into: "crs_3" },
					{ courseId: "crs_2", into: "crs_3" },
				],
				remove: [],
			},
		);
	});

	it("keeps apart overlapping years and a handoff with two ways in or out", () => {
		const { merge } = planLinks(
			[
				live("off_1"),
				live("off_2", { departmentId: "dep_b" }),
				live("off_3", { departmentId: "dep_b", academicYear: 2032 }),
				live("off_4", { title: "Інше" }),
				live("off_5", {
					title: "Інше",
					departmentId: "dep_b",
					academicYear: 2032,
				}),
				live("off_6", {
					title: "Інше",
					departmentId: "dep_c",
					academicYear: 2032,
				}),
				live("off_7", { title: "Третє" }),
				live("off_8", { title: "Третє", departmentId: "dep_c" }),
				live("off_9", {
					title: "Третє",
					departmentId: "dep_b",
					academicYear: 2032,
				}),
			],
			[
				course("crs_1"),
				course("crs_2", { departmentId: "dep_b" }),
				course("crs_4", { title: "Інше" }),
				course("crs_5", { title: "Інше", departmentId: "dep_b" }),
				course("crs_6", { title: "Інше", departmentId: "dep_c" }),
				course("crs_7", { title: "Третє" }),
				course("crs_8", { title: "Третє", departmentId: "dep_c" }),
				course("crs_9", { title: "Третє", departmentId: "dep_b" }),
			],
		);

		assert.deepStrictEqual(merge, []);
	});

	it("keeps a handed-off course a decision holds an offering in", () => {
		assert.deepStrictEqual(
			planLinks(
				[
					live("off_1", { courseId: "crs_1" }),
					live("off_2", { courseId: "crs_1", courseSource: "decision" }),
					live("off_3", { departmentId: "dep_b", academicYear: 2032 }),
				],
				[course("crs_1"), course("crs_2", { departmentId: "dep_b" })],
			).merge,
			[],
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
		readonly departmentId: string | null;
		readonly mergedInto: string | null;
		readonly mergeSource: string | null;
		readonly removed: boolean;
		readonly changeNo: bigint;
	}>`
		SELECT id, department_id AS "departmentId", merged_into AS "mergedInto",
			merge_source AS "mergeSource", removed_at IS NOT NULL AS removed, change_no AS "changeNo"
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
				assert.deepInclude(yield* groupCourses({}), { merged: 1 });

				const before = { groups: yield* groups, courses: yield* courses };
				const last = yield* lastChange;

				assert.deepStrictEqual(yield* groupCourses({}), {
					added: 0,
					restored: 0,
					unmerged: 0,
					moved: 0,
					merged: 0,
					removed: 0,
				});
				assert.deepStrictEqual(
					{ groups: yield* groups, courses: yield* courses },
					before,
				);
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
			"merges a department handoff and follows it to the next department",
			() =>
				Effect.gen(function* () {
					yield* reset;

					yield* write([
						offering("900031"),
						offering("900032", { ...otherDepartment, academicYear: 2032 }),
						offering("900033", { ...otherDepartment, academicYear: 2033 }),
					]);
					yield* groupCourses({});

					const handedOff = yield* groups;
					const target = handedOff[1]?.courseId;

					assert.deepStrictEqual(
						handedOff.map(({ courseId }) => courseId),
						Array(3).fill(target),
					);
					assert.sameDeepMembers(
						(yield* courses).map(({ id, mergedInto, removed }) => ({
							target: id === target,
							mergedInto,
							removed,
						})),
						[
							{ target: true, mergedInto: null, removed: false },
							{ target: false, mergedInto: target, removed: true },
						],
					);

					yield* write([
						offering("900034", {
							department: "Кафедра вигаданої етики",
							academicYear: 2034,
						}),
					]);

					assert.deepInclude(yield* groupCourses({}), {
						added: 1,
						moved: 4,
						merged: 2,
						removed: 0,
					});

					const chained = yield* groups;
					const all = yield* courses;
					const third = chained[3]?.courseId;

					assert.deepStrictEqual(
						chained.map(({ courseId }) => courseId),
						Array(4).fill(third),
					);
					assert.strictEqual(
						all.find(({ id }) => id === target)?.mergedInto,
						third,
					);
					assert.strictEqual(
						all.filter(({ mergedInto }) => mergedInto === null).length,
						1,
					);
				}),
		);

		it.effect("undoes the rule's merge when the handoff stops holding", () =>
			Effect.gen(function* () {
				yield* reset;

				yield* write([
					offering("900041"),
					offering("900042", { ...otherDepartment, academicYear: 2032 }),
				]);
				yield* groupCourses({});

				const [merged] = (yield* courses).filter(
					({ mergedInto }) => mergedInto !== null,
				);

				assert.strictEqual(merged?.mergeSource, "rule");

				// The earlier department teaches it again in the later year.
				yield* write([offering("900043", { academicYear: 2032 })]);

				assert.deepInclude(yield* groupCourses({}), {
					added: 0,
					unmerged: 1,
					moved: 2,
					merged: 0,
				});
				assert.deepStrictEqual(
					(yield* groups).map(({ courseId }) => courseId === merged?.id),
					[true, false, true],
				);
				assert.deepInclude(
					(yield* courses).find(({ id }) => id === merged?.id),
					{ mergedInto: null, mergeSource: null, removed: false },
				);

				const last = yield* lastChange;

				assert.deepInclude(yield* groupCourses({}), {
					unmerged: 0,
					moved: 0,
				});
				assert.strictEqual(yield* lastChange, last);
			}),
		);

		it.effect(
			"points a rule merge at the course its shortened chain ends in",
			() =>
				Effect.gen(function* () {
					yield* reset;

					const third = { department: "Кафедра вигаданої етики" };

					yield* write([
						offering("900051"),
						offering("900052", { ...otherDepartment, academicYear: 2032 }),
						offering("900053", { ...third, academicYear: 2033 }),
					]);
					yield* groupCourses({});

					// The third department teaches it in the first year too, so the
					// second no longer hands off to it.
					yield* write([offering("900054", third)]);

					assert.deepInclude(yield* groupCourses({}), {
						unmerged: 1,
						merged: 1,
					});

					const [first, second, , late] = yield* groups;
					const all = yield* courses;

					assert.strictEqual(first?.courseId, second?.courseId);
					assert.notStrictEqual(second?.courseId, late?.courseId);
					assert.sameDeepMembers(
						all
							.filter(({ mergedInto }) => mergedInto !== null)
							.map(({ mergedInto, mergeSource }) => ({
								mergedInto,
								mergeSource,
							})),
						[{ mergedInto: second?.courseId, mergeSource: "rule" }],
					);
				}),
		);
	});
});
