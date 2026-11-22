import { NodeServices } from "@effect/platform-node";
import { assert, describe, layer } from "@effect/vitest";
import { Effect, Exit, Layer } from "effect";
import { Command } from "effect/cli";
import { SqlClient } from "effect/sql";
import { TestConsole } from "effect/testing";
import { Audit } from "../audit/Audit.ts";
import { ChangeLog } from "../changes/ChangeLog.ts";
import { TestDatabase, testDatabaseUrl } from "../db/testing.ts";
import { offering } from "../offerings/offering.fixture.ts";
import { OfferingStore } from "../offerings/OfferingStore.ts";
import { reset } from "../offerings/testing.ts";
import { courseCommands } from "./commands.ts";
import { groupCourses } from "./courses.ts";
import { CourseStore } from "./CourseStore.ts";
import { courses, groups, lastChange, write } from "./testing.ts";

const Services = CourseStore.layer.pipe(
	Layer.provideMerge(Layer.mergeAll(ChangeLog.layer, Audit.layer)),
);

const cli = Command.make("ukma-data").pipe(
	Command.withSubcommands([courseCommands(Services)]),
);

/** Runs one command line and returns its exit and what it printed. */
const run = (args: ReadonlyArray<string>) =>
	Effect.gen(function* () {
		const exit = yield* Effect.exit(
			Command.runWith(cli, { version: "0.0.0" })(args),
		);

		const lines = (yield* TestConsole.logLines).map(String);
		const errors = (yield* TestConsole.errorLines).map(String);

		return { exit, lines, errors };
	}).pipe(Effect.provide(TestConsole.layer));

const auditCount = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;

	const [row] = yield* sql<{ readonly n: number }>`
		SELECT count(*)::int AS n FROM audit_log
		WHERE action IN ('course_merged', 'course_unmerged') AND key_id IS NULL
	`;

	return row?.n;
});

/** Two bachelor courses, one of two offerings, and a master course. */
const setUp = Effect.gen(function* () {
	yield* reset;

	yield* write([
		offering("900071"),
		offering("900072", { academicYear: 2032 }),
		offering("900073", { title: "Вигадана топологія" }),
		offering("900074", { level: "master" }),
	]);
	yield* groupCourses({});

	const courseOf = new Map(
		(yield* groups).map((row) => [row.sazCode, row.courseId]),
	);

	return {
		first: courseOf.get("900071") ?? "",
		second: courseOf.get("900073") ?? "",
		master: courseOf.get("900074") ?? "",
	};
});

const TestLive = Layer.mergeAll(CourseStore.layer, OfferingStore.layer).pipe(
	Layer.provideMerge(Layer.mergeAll(ChangeLog.layer, Audit.layer)),
	Layer.provideMerge(NodeServices.layer),
	Layer.provideMerge(TestDatabase(testDatabaseUrl)),
);

describe("course commands", () => {
	layer(TestLive, { timeout: 30_000, excludeTestServices: true })((it) => {
		it.effect("merge without --yes prints the change and writes nothing", () =>
			Effect.gen(function* () {
				const { first, second } = yield* setUp;
				const before = yield* lastChange;
				const stored = yield* courses;

				const { exit, lines } = yield* run([
					"courses",
					"merge",
					first,
					"--into",
					second,
				]);

				assert.isTrue(Exit.isSuccess(exit));
				assert.deepStrictEqual(lines, [
					"Would change:",
					`\tcourse ${first} "Вступ до вигаданих систем" (bachelor): merged_into none -> ${second}; merge_source none -> decision; removed no -> yes; live offerings 2 -> 0`,
					`\tcourse ${second} "Вигадана топологія" (bachelor): live offerings 1 -> 3`,
					"Rows written:",
					"\tcourses: 1 remove",
					"\tofferings: 2 change",
					"Audit: recorded with no key, as the command line",
					"Dry run: nothing written. Add --yes to apply.",
				]);
				assert.strictEqual(yield* lastChange, before);
				assert.deepStrictEqual(yield* courses, stored);
				assert.strictEqual(yield* auditCount, 0);
			}),
		);

		it.effect(
			"merge --yes and unmerge --yes write with a keyless audit row",
			() =>
				Effect.gen(function* () {
					const { first, second } = yield* setUp;

					const merged = yield* run([
						"courses",
						"merge",
						first,
						"--into",
						second,
						"--yes",
					]);

					assert.isTrue(Exit.isSuccess(merged.exit));
					assert.deepStrictEqual(merged.lines, [
						`Merged course ${first} into ${second}`,
					]);
					assert.deepInclude(
						(yield* courses).find(({ id }) => id === first),
						{ mergedInto: second, mergeSource: "decision" },
					);

					const preview = yield* run(["courses", "unmerge", first]);

					assert.include(
						preview.lines,
						`\tcourse ${first} "Вступ до вигаданих систем" (bachelor): merged_into ${second} -> none; merge_source decision -> none; removed yes -> no; live offerings 0 -> 2`,
					);
					assert.deepInclude(
						(yield* courses).find(({ id }) => id === first),
						{ mergedInto: second },
					);

					const unmerged = yield* run(["courses", "unmerge", first, "--yes"]);

					assert.deepStrictEqual(unmerged.lines, [`Unmerged course ${first}`]);
					assert.deepInclude(
						(yield* courses).find(({ id }) => id === first),
						{ mergedInto: null, removed: false },
					);
					assert.strictEqual(yield* auditCount, 2);
				}),
		);

		it.effect("a refused or unknown course prints one line and fails", () =>
			Effect.gen(function* () {
				const { first, second, master } = yield* setUp;
				const before = yield* lastChange;

				const cases = [
					[
						["courses", "merge", first, "--into", master],
						"Refused (level_mismatch): the two courses have different levels",
					],
					[
						["courses", "merge", first, "--into", "crs_missing", "--yes"],
						"No course crs_missing",
					],
					[
						["courses", "unmerge", second],
						"Refused (not_merged): the course is not merged",
					],
				] as const;

				for (const [args, line] of cases) {
					const { exit, lines, errors } = yield* run(args);

					assert.isTrue(Exit.isFailure(exit));
					assert.deepStrictEqual(lines, []);
					assert.deepStrictEqual(errors, [line]);
				}

				assert.strictEqual(yield* lastChange, before);
			}),
		);
	});
});
