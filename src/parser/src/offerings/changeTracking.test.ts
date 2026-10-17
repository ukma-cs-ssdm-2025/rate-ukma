import { assert, describe, layer } from "@effect/vitest";
import { Effect, Layer, Result } from "effect";
import { SqlClient } from "effect/sql";
import { ChangeLog } from "../changes/ChangeLog.ts";
import { sourcePartOf } from "../crawl/crawl.ts";
import { TestDatabase, testDatabaseUrl } from "../db/testDatabase.ts";
import { coursePage } from "../saz/coursePage.fixture.ts";
import { parseCoursePage } from "../saz/coursePage.ts";
import {
	catalogFiltersOf,
	offeringRowsOf,
	parseOfferings,
} from "./offerings.ts";
import { OfferingStore } from "./OfferingStore.ts";
import { RemovalStore } from "./RemovalStore.ts";
import { removeOfferings } from "./removals.ts";

const TestLive = Layer.mergeAll(OfferingStore.layer, RemovalStore.layer).pipe(
	Layer.provideMerge(ChangeLog.layer),
	Layer.provideMerge(TestDatabase(testDatabaseUrl ?? "")),
);

interface Listed {
	readonly code: string;
	readonly title?: string;
	readonly unit?: ReadonlyArray<string>;
	readonly failed?: boolean;
}

const unitRow = (header: string, name: string) =>
	`<tr><th><abbr title="${header}">${header.split(",")[0]}</abbr></th><td>${name}</td></tr>`;

/** The fixture's department under another faculty. */
const MOVED_DEPARTMENT = [
	unitRow(
		"Факультет, який забезпечує викладання дисципліни",
		"Факультет уявних мистецтв",
	),
	unitRow(
		"Кафедра, яка забезпечує викладання дисципліни",
		"Кафедра вигаданих систем",
	),
];

/** Stores a finished run of one year that lists these courses, as the crawl
 *  does: a page whose content did not change keeps its latest snapshot. */
const crawl = (year: number, listed: ReadonlyArray<Listed>) =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;

		const [run] = yield* sql<{ readonly id: bigint }>`
			INSERT INTO runs (source_part, status, finished_at)
			VALUES (${sourcePartOf(year)}, 'succeeded', now())
			RETURNING id
		`;

		const runId = run?.id ?? 0n;

		yield* sql`
			INSERT INTO run_pages (run_id, kind, path, status, finished_at)
			VALUES (${runId}, 'catalog', ${`/course/catalog?year=${year}`}, 'done', now())
		`;

		for (const { code, title, unit, failed = false } of listed) {
			const path = `/course/${code}`;

			if (failed) {
				yield* sql`
					INSERT INTO run_pages (run_id, kind, path, status, error, finished_at)
					VALUES (${runId}, 'course', ${path}, 'failed', 'HTTP 500', now())
				`;
				continue;
			}

			const content = coursePage({
				code,
				title,
				unit,
				year: `${year}–${year + 1}`,
			});

			const [latest] = yield* sql<{
				readonly id: bigint;
				readonly content: string;
			}>`
				SELECT id, content FROM page_snapshots
				WHERE path = ${path} ORDER BY id DESC LIMIT 1
			`;

			const [stored] =
				latest?.content === content
					? [latest]
					: yield* sql<{ readonly id: bigint }>`
							INSERT INTO page_snapshots (path, kind, content_hash, content, run_id)
							VALUES (${path}, 'course', ${`hash ${content.length}`}, ${content}, ${runId})
							RETURNING id
						`;

			yield* sql`
				INSERT INTO run_pages (run_id, kind, path, status, snapshot_id, finished_at)
				VALUES (${runId}, 'course', ${path}, 'done', ${stored?.id ?? null}, now())
			`;
		}

		return runId;
	});

interface StoredOffering {
	readonly id: string;
	readonly changeNo: bigint;
	readonly removed: boolean;
}

const offeringsOf = (year: number) =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;

		const rows = yield* sql<StoredOffering & { readonly sazCode: string }>`
			SELECT id, saz_code AS "sazCode", change_no AS "changeNo",
				removed_at IS NOT NULL AS removed
			FROM offerings WHERE academic_year = ${year}
		`;

		return new Map(rows.map(({ sazCode, ...row }) => [sazCode, row]));
	});

const trailOf = (rowId: string) =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;

		return yield* sql<{
			readonly changeNo: bigint;
			readonly action: string;
			readonly runId: bigint | null;
		}>`
			SELECT change_no AS "changeNo", action, run_id AS "runId" FROM changes
			WHERE row_id = ${rowId} ORDER BY change_no
		`;
	});

const removalsOf = (runId: bigint) =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;

		const [run] = yield* sql<{ readonly decision: string | null }>`
			SELECT offering_removals AS decision FROM runs WHERE id = ${runId}
		`;

		return run?.decision;
	});

describe.skipIf(testDatabaseUrl === undefined)("change tracking", () => {
	layer(TestLive, { timeout: 30_000, excludeTestServices: true })((it) => {
		it.effect(
			"numbers a row once per change, so a second parse takes no number",
			() =>
				Effect.gen(function* () {
					yield* crawl(2031, [{ code: "910001" }, { code: "910002" }]);

					const first = yield* parseOfferings("crawl");

					assert.deepInclude(first.changes, {
						table: "offerings",
						action: "add",
						rows: 2,
					});

					const before = yield* offeringsOf(2031);
					const again = yield* parseOfferings("reparse");

					assert.deepStrictEqual(again.changes, []);
					assert.deepStrictEqual(yield* offeringsOf(2031), before);

					yield* crawl(2031, [
						{ code: "910001", title: "Вигадана теорія систем" },
						{ code: "910002" },
					]);

					const changed = yield* parseOfferings("crawl");
					const after = yield* offeringsOf(2031);

					assert.deepStrictEqual(changed.changes, [
						{ table: "offerings", action: "change", rows: 1 },
					]);
					assert.isAbove(
						Number(after.get("910001")?.changeNo),
						Number(before.get("910001")?.changeNo),
					);
					assert.deepStrictEqual(after.get("910002"), before.get("910002"));
				}),
		);

		it.effect(
			"removes an offering its run no longer lists and restores it when it returns",
			() =>
				Effect.gen(function* () {
					yield* crawl(2032, [{ code: "920001" }, { code: "920002" }]);
					yield* parseOfferings("crawl");
					yield* removeOfferings(1);

					const listed = yield* offeringsOf(2032);
					const dropped = yield* crawl(2032, [{ code: "920001" }]);
					const [decided] = yield* removeOfferings(1);

					assert.deepInclude(decided, { decision: "applied", removed: 1 });

					const removed = (yield* offeringsOf(2032)).get("920002");

					assert.isTrue(removed?.removed);
					assert.isAbove(
						Number(removed?.changeNo),
						Number(listed.get("920002")?.changeNo),
					);
					assert.deepInclude((yield* trailOf(removed?.id ?? "")).at(-1), {
						action: "remove",
						runId: dropped,
					});

					// Its page is still the latest snapshot of its path.
					yield* parseOfferings("reparse");
					assert.deepStrictEqual(
						(yield* offeringsOf(2032)).get("920002"),
						removed,
					);

					yield* crawl(2032, [{ code: "920001" }, { code: "920002" }]);
					yield* parseOfferings("crawl");

					const restored = (yield* offeringsOf(2032)).get("920002");

					assert.isFalse(restored?.removed);
					assert.isAbove(Number(restored?.changeNo), Number(removed?.changeNo));
					assert.strictEqual(
						(yield* trailOf(restored?.id ?? "")).at(-1)?.action,
						"restore",
					);
				}),
		);

		it.effect("skips the removals of a run that missed a course page", () =>
			Effect.gen(function* () {
				yield* crawl(2033, [{ code: "930001" }, { code: "930002" }]);
				yield* parseOfferings("crawl");

				const partial = yield* crawl(2033, [
					{ code: "930001" },
					{ code: "930002", failed: true },
				]);

				yield* removeOfferings(1);

				assert.strictEqual(yield* removalsOf(partial), "skipped");
				assert.isFalse((yield* offeringsOf(2033)).get("930002")?.removed);
			}),
		);

		it.effect(
			"holds removals above the threshold as one review case and publishes the rest",
			() =>
				Effect.gen(function* () {
					const sql = yield* SqlClient.SqlClient;
					const codes = Array.from({ length: 20 }, (_, i) => `${940000 + i}`);

					yield* crawl(
						2034,
						codes.map((code) => ({ code })),
					);
					yield* parseOfferings("crawl");
					yield* removeOfferings(0.05);

					// Two of 21 offerings leave the catalog; 5% allows one.
					const shrunk = yield* crawl(2034, [
						...codes.slice(0, 18).map((code) => ({ code })),
						{ code: "940020" },
					]);

					yield* parseOfferings("crawl");
					yield* removeOfferings(0.05);

					const held = yield* offeringsOf(2034);

					assert.strictEqual(yield* removalsOf(shrunk), "held");
					assert.isFalse(held.get("940018")?.removed);
					assert.isFalse(held.get("940020")?.removed);

					const cases = yield* sql<{
						readonly status: string;
						readonly offeringIds: ReadonlyArray<string>;
					}>`
						SELECT status, candidates -> 'offeringIds' AS "offeringIds"
						FROM review_cases
						WHERE kind = 'removals_held' AND run_id = ${shrunk}
					`;

					assert.deepStrictEqual(cases, [
						{
							status: "open",
							offeringIds: [
								held.get("940018")?.id ?? "",
								held.get("940019")?.id ?? "",
							].sort(),
						},
					]);

					// The same removals again keep the case staff are looking at.
					const again = yield* crawl(2034, [
						...codes.slice(0, 18).map((code) => ({ code })),
						{ code: "940020" },
					]);

					yield* removeOfferings(0.05);
					assert.strictEqual(yield* removalsOf(again), "held");

					const open = yield* sql<{ readonly runId: bigint }>`
						SELECT run_id AS "runId" FROM review_cases
						WHERE kind = 'removals_held' AND status = 'open'
							AND (candidates ->> 'academicYear')::int = 2034
					`;

					assert.deepStrictEqual(open, [{ runId: shrunk }]);

					yield* crawl(
						2034,
						[...codes, "940020"].map((code) => ({ code })),
					);
					yield* removeOfferings(0.05);

					const [closed] = yield* sql<{ readonly status: string }>`
						SELECT status FROM review_cases WHERE run_id = ${shrunk}
					`;

					assert.strictEqual(closed?.status, "obsolete");
				}),
		);

		it.effect(
			"leaves an older run undecided while a newer run of its year is open",
			() =>
				Effect.gen(function* () {
					const sql = yield* SqlClient.SqlClient;

					yield* crawl(2036, [{ code: "960001" }, { code: "960002" }]);
					yield* parseOfferings("crawl");
					yield* removeOfferings(1);

					const older = yield* crawl(2036, [{ code: "960001" }]);

					yield* sql`INSERT INTO runs (source_part) VALUES (${sourcePartOf(2036)})`;
					yield* removeOfferings(1);

					assert.isNull(yield* removalsOf(older));
					assert.isFalse((yield* offeringsOf(2036)).get("960002")?.removed);
				}),
		);

		it.effect(
			"keeps a department's faculty when cards in two batches disagree",
			() =>
				Effect.gen(function* () {
					const store = yield* OfferingStore;

					yield* crawl(2037, [
						{ code: "970001" },
						{ code: "970002", unit: MOVED_DEPARTMENT },
					]);

					const parsed = (yield* store.coursePages(
						yield* store.latestCoursePages,
					)).flatMap(({ id, path, content }) => {
						const code = path.slice("/course/".length);
						const result = parseCoursePage(content, code);

						return code.startsWith("97") && Result.isSuccess(result)
							? [{ snapshotId: id, offering: result.success }]
							: [];
					});

					const batches = parsed.map((page) =>
						offeringRowsOf([page], catalogFiltersOf("")),
					);

					const parseId = yield* store.startParse("reparse");
					const passes = [];

					for (let pass = 0; pass < 2; pass++) {
						const counts = [];

						for (const rows of batches) {
							counts.push(yield* store.write(rows, parseId));
						}

						passes.push(counts);
					}

					assert.strictEqual(batches.length, 2);
					assert.deepStrictEqual(passes[1], [[], []]);
				}),
		);

		it.effect(
			"renumbers an offering whose department now resolves to another row",
			() =>
				Effect.gen(function* () {
					const sql = yield* SqlClient.SqlClient;

					yield* crawl(2038, [{ code: "980001" }]);
					yield* parseOfferings("crawl");

					const before = (yield* offeringsOf(2038)).get("980001");

					// The card is unchanged; only the row its department name resolves
					// to differs, as after a department rename.
					yield* sql`
						UPDATE offerings SET department_id = NULL WHERE saz_code = '980001'
					`;

					const report = yield* parseOfferings("reparse");

					const [after] = yield* sql<{ readonly departmentId: string | null }>`
						SELECT department_id AS "departmentId" FROM offerings
						WHERE saz_code = '980001'
					`;

					assert.deepStrictEqual(report.changes, [
						{ table: "offerings", action: "change", rows: 1 },
					]);
					assert.isNotNull(after?.departmentId);
					assert.isAbove(
						Number((yield* offeringsOf(2038)).get("980001")?.changeNo),
						Number(before?.changeNo),
					);
				}),
		);
	});
});
