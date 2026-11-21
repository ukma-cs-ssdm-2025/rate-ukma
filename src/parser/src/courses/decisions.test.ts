import { assert, describe, layer } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { SqlClient } from "effect/sql";
import { Audit } from "../audit/Audit.ts";
import { ChangeLog } from "../changes/ChangeLog.ts";
import { TestDatabase, testDatabaseUrl } from "../db/testing.ts";
import { Keys } from "../keys/Keys.ts";
import { offering } from "../offerings/offering.fixture.ts";
import { OfferingStore } from "../offerings/OfferingStore.ts";
import { reset } from "../offerings/testing.ts";
import type { ParsedOffering } from "../saz/coursePage.ts";
import { groupCourses } from "./courses.ts";
import { CourseStore } from "./CourseStore.ts";
import {
	CourseDecisionRefused,
	type CourseNotFound,
	mergeCourse,
	unmergeCourse,
} from "./decisions.ts";
import { courses, groups, lastChange, write } from "./testing.ts";

const TestLive = Layer.mergeAll(
	CourseStore.layer,
	OfferingStore.layer,
	Keys.layer,
).pipe(
	Layer.provideMerge(Layer.mergeAll(ChangeLog.layer, Audit.layer)),
	Layer.provideMerge(TestDatabase(testDatabaseUrl)),
);

const otherTitle = { title: "Вигадана логіка" };

const otherDepartment = { department: "Кафедра вигаданої логіки" };

/** Two grouped courses of one level, and a key to decide with. */
const setUp = Effect.fnUntraced(function* (
	second: Partial<ParsedOffering> = otherTitle,
) {
	yield* reset;

	yield* write([
		offering("900061"),
		offering("900062", { academicYear: 2032 }),
		offering("900063", second),
		offering("900064", { level: "master" }),
	]);
	yield* groupCourses({});

	const courseOf = new Map(
		(yield* groups).map((row) => [row.sazCode, row.courseId]),
	);

	const key = yield* (yield* Keys).create({
		name: "test staff",
		scopes: ["review:decide"],
		expiresInDays: 30,
		createdBy: null,
	});

	return {
		keyId: key.id,
		first: courseOf.get("900061") ?? "",
		second: courseOf.get("900063") ?? "",
		master: courseOf.get("900064") ?? "",
	};
});

describe("course decisions", () => {
	layer(TestLive, { timeout: 30_000, excludeTestServices: true })((it) => {
		it.effect("merges a course, and the next grouping keeps it", () =>
			Effect.gen(function* () {
				const { keyId, first, second } = yield* setUp();
				const before = yield* lastChange;

				yield* mergeCourse(keyId, first, second);

				assert.deepStrictEqual(
					(yield* groups).map(({ courseId, courseSource }) => [
						courseId === second,
						courseSource,
					]),
					[
						[true, "decision"],
						[true, "decision"],
						[true, "rule"],
						[false, "rule"],
					],
				);
				assert.deepInclude(
					(yield* courses).find(({ id }) => id === first),
					{ mergedInto: second, mergeSource: "decision", removed: true },
				);

				const sql = yield* SqlClient.SqlClient;

				assert.deepStrictEqual(
					yield* sql<{ readonly tableName: string; readonly action: string }>`
						SELECT table_name AS "tableName", action FROM changes
						WHERE change_no > ${before ?? 0} ORDER BY change_no
					`,
					[
						{ tableName: "offerings", action: "change" },
						{ tableName: "offerings", action: "change" },
						{ tableName: "courses", action: "remove" },
					],
				);
				assert.deepStrictEqual(
					yield* sql`
						SELECT target_id AS "targetId", related_id AS "relatedId"
						FROM audit_log
						WHERE key_id = ${keyId} AND action = 'course_merged'
					`,
					[{ targetId: first, relatedId: second }],
				);

				const last = yield* lastChange;

				assert.deepInclude(yield* groupCourses({}), {
					added: 0,
					unmerged: 0,
					moved: 0,
					merged: 0,
					removed: 0,
				});
				assert.strictEqual(yield* lastChange, last);
			}),
		);

		it.effect(
			"refuses a merge into itself, a merged course or across levels",
			() =>
				Effect.gen(function* () {
					const { keyId, first, second, master } = yield* setUp();

					const reasonOf = (error: CourseNotFound | CourseDecisionRefused) =>
						error instanceof CourseDecisionRefused ? error.reason : error._tag;

					const refused = (id: string, into: string) =>
						Effect.flip(mergeCourse(keyId, id, into)).pipe(
							Effect.map(reasonOf),
						);

					yield* mergeCourse(keyId, first, second);

					const last = yield* lastChange;

					assert.deepStrictEqual(
						[
							yield* refused(second, second),
							yield* refused(master, first),
							yield* refused(first, master),
							yield* refused(second, master),
							yield* refused("crs_missing", second),
							yield* refused(first, "crs_missing"),
							yield* Effect.flip(unmergeCourse(keyId, second)).pipe(
								Effect.map(reasonOf),
							),
						],
						[
							"same_course",
							"target_merged",
							"course_merged",
							"level_mismatch",
							"CourseNotFound",
							"CourseNotFound",
							"not_merged",
						],
					);
					assert.strictEqual(yield* lastChange, last);
				}),
		);

		it.effect(
			"brings back a removed course a merge moves live offerings to",
			() =>
				Effect.gen(function* () {
					const { keyId, first, second } = yield* setUp();

					// Its only offering takes the first course's title, so it empties.
					yield* write([offering("900063")]);
					yield* groupCourses({});

					assert.deepInclude(
						(yield* courses).find(({ id }) => id === second),
						{ removed: true },
					);

					yield* mergeCourse(keyId, first, second);

					assert.deepInclude(
						(yield* courses).find(({ id }) => id === second),
						{ removed: false, mergedInto: null },
					);
				}),
		);

		it.effect(
			"points a course merged into an unmerged one at that one's target",
			() =>
				Effect.gen(function* () {
					const { keyId, first, second } = yield* setUp();

					yield* write([offering("900065", { title: "Вигадана етика" })]);
					yield* groupCourses({});

					const third =
						(yield* groups).find(({ sazCode }) => sazCode === "900065")
							?.courseId ?? "";

					yield* mergeCourse(keyId, first, second);
					yield* mergeCourse(keyId, second, third);
					yield* unmergeCourse(keyId, second);

					const all = yield* courses;

					assert.deepStrictEqual(
						[first, second].map(
							(id) => all.find((row) => row.id === id)?.mergedInto,
						),
						[third, null],
					);

					const courseOf = new Map(
						(yield* groups).map((row) => [row.sazCode, row.courseId]),
					);

					assert.deepStrictEqual(
						["900061", "900062", "900063", "900065"].map((code) =>
							courseOf.get(code),
						),
						[third, third, second, third],
					);
				}),
		);

		it.effect("unmerges a staff merge, and the next grouping keeps it", () =>
			Effect.gen(function* () {
				const { keyId, first, second } = yield* setUp();

				yield* mergeCourse(keyId, first, second);
				yield* unmergeCourse(keyId, first);

				assert.deepStrictEqual(
					(yield* groups).map(({ courseId, courseSource }) => [
						courseId === first,
						courseSource,
					]),
					[
						[true, "decision"],
						[true, "decision"],
						[false, "rule"],
						[false, "rule"],
					],
				);
				assert.deepInclude(
					(yield* courses).find(({ id }) => id === first),
					{ mergedInto: null, mergeSource: null, removed: false },
				);

				const last = yield* lastChange;

				yield* groupCourses({});

				assert.strictEqual(yield* lastChange, last);
			}),
		);

		it.effect(
			"unmerge takes back what its merge moved, renamed or not, and no more",
			() =>
				Effect.gen(function* () {
					const { keyId, first, second } = yield* setUp();

					yield* mergeCourse(keyId, first, second);
					yield* write([
						offering("900062", {
							academicYear: 2032,
							title: "Вигадана перейменована назва",
						}),
						offering("900066", { academicYear: 2034 }),
					]);
					yield* groupCourses({});

					const later =
						(yield* groups).find(({ sazCode }) => sazCode === "900066")
							?.courseId ?? "";

					assert.notInclude([first, second], later);

					yield* mergeCourse(keyId, later, second);
					yield* unmergeCourse(keyId, first);

					const courseOf = new Map(
						(yield* groups).map((row) => [row.sazCode, row.courseId]),
					);

					assert.deepStrictEqual(
						["900061", "900062", "900063", "900066"].map((code) =>
							courseOf.get(code),
						),
						[first, first, second, second],
					);
				}),
		);

		it.effect(
			"unmerging a handoff leaves an offering another merge brought, even renamed to its key",
			() =>
				Effect.gen(function* () {
					const { keyId, second } = yield* setUp({
						...otherDepartment,
						academicYear: 2033,
					});

					const handedOff =
						(yield* courses).find(({ mergeSource }) => mergeSource === "rule")
							?.id ?? "";

					yield* write([offering("900067", otherTitle)]);
					yield* groupCourses({});

					const other =
						(yield* groups).find(({ sazCode }) => sazCode === "900067")
							?.courseId ?? "";

					yield* mergeCourse(keyId, other, second);
					yield* write([offering("900067")]);
					yield* unmergeCourse(keyId, handedOff);

					const courseOf = new Map(
						(yield* groups).map((row) => [row.sazCode, row.courseId]),
					);

					assert.deepStrictEqual(
						["900061", "900062", "900067"].map((code) => courseOf.get(code)),
						[handedOff, handedOff, second],
					);
				}),
		);

		it.effect(
			"unmerging a staff merge keeps a handoff into it with its offerings",
			() =>
				Effect.gen(function* () {
					const { keyId, second } = yield* setUp({
						...otherDepartment,
						academicYear: 2033,
					});

					const handedOff =
						(yield* courses).find(({ mergeSource }) => mergeSource === "rule")
							?.id ?? "";

					yield* write([offering("900068", otherTitle)]);
					yield* groupCourses({});

					const third =
						(yield* groups).find(({ sazCode }) => sazCode === "900068")
							?.courseId ?? "";

					yield* mergeCourse(keyId, second, third);
					yield* unmergeCourse(keyId, second);

					const courseOf = Effect.map(
						groups,
						(rows) => new Map(rows.map((row) => [row.sazCode, row.courseId])),
					);

					assert.strictEqual(
						(yield* courses).find(({ id }) => id === handedOff)?.mergedInto,
						second,
					);
					const before = yield* courseOf;

					assert.deepStrictEqual(
						["900061", "900062", "900063"].map((code) => before.get(code)),
						[second, second, second],
					);

					yield* unmergeCourse(keyId, handedOff);

					const after = yield* courseOf;

					assert.deepStrictEqual(
						["900061", "900062"].map((code) => after.get(code)),
						[handedOff, handedOff],
					);
				}),
		);

		it.effect(
			"unmerges a department handoff, and the rule does not merge it again",
			() =>
				Effect.gen(function* () {
					const { keyId, second } = yield* setUp({
						...otherDepartment,
						academicYear: 2033,
					});

					const [merged] = (yield* courses).filter(
						({ mergeSource }) => mergeSource === "rule",
					);

					const first = merged?.id ?? "";

					assert.strictEqual(merged?.mergedInto, second);

					yield* unmergeCourse(keyId, first);

					const last = yield* lastChange;

					assert.deepInclude(yield* groupCourses({}), {
						unmerged: 0,
						merged: 0,
					});
					assert.strictEqual(yield* lastChange, last);
					assert.deepStrictEqual(
						(yield* groups).map(({ courseId }) => courseId === first),
						[true, true, false, false],
					);
				}),
		);
	});
});
