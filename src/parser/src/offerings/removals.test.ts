import { assert, describe, it, layer } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { SqlClient } from "effect/sql";
import { ChangeLog } from "../changes/ChangeLog.ts";
import { sourcePartOf } from "../crawl/crawl.ts";
import { TestDatabase, testDatabaseUrl } from "../db/testing.ts";
import { parseOfferings } from "./offerings.ts";
import { OfferingStore } from "./OfferingStore.ts";
import { RemovalStore, type RemovalSurvey } from "./RemovalStore.ts";
import { planRemovals, removeOfferings } from "./removals.ts";
import { crawl, offeringsOf, reset } from "./testing.ts";

const ids = (count: number) =>
	Array.from({ length: count }, (_, index) => `off_${index}`);

/** A complete run that saw every course page 1 listed. */
const survey = (patch: Partial<RemovalSurvey>): RemovalSurvey => ({
	complete: true,
	missingPages: 0,
	listed: 3250,
	laterTotals: [3250, 3250],
	seen: 3250,
	live: 3250,
	candidates: [],
	...patch,
});

describe("planRemovals", () => {
	it("applies removals up to the threshold and holds one more", () => {
		// 5% of 3,250 offerings is 162.5, so the limit is 162.
		assert.deepStrictEqual(
			planRemovals(survey({ candidates: ids(162) }), 0.05),
			{ decision: "applied", ids: ids(162) },
		);
		assert.deepStrictEqual(
			planRemovals(survey({ candidates: ids(163) }), 0.05),
			{ decision: "held", ids: ids(163) },
		);
	});

	it("skips a run that missed a catalog or course page", () => {
		assert.deepStrictEqual(
			planRemovals(
				survey({ complete: false, missingPages: 1, candidates: ids(1) }),
				0.05,
			),
			{ decision: "skipped", reason: "run missed 1 pages" },
		);
	});

	it("skips a run that saw fewer courses than page 1 listed", () => {
		assert.deepStrictEqual(
			planRemovals(survey({ seen: 3249, candidates: ids(1) }), 0.05),
			{
				decision: "skipped",
				reason: "catalog page 1 listed 3250 courses, the run saw 3249",
			},
		);
		assert.deepStrictEqual(
			planRemovals(survey({ listed: undefined, candidates: ids(1) }), 0.05),
			{
				decision: "skipped",
				reason: "run stored no catalog page 1",
			},
		);
	});

	it("skips a run whose catalog grew while it was read", () => {
		// A course arrived before page 3 was read: its total grew, the run saw
		// as many codes as page 1 listed, and the last card went past the last
		// page.
		assert.deepStrictEqual(
			planRemovals(
				survey({ laterTotals: [3250, 3251], candidates: ids(1) }),
				0.05,
			),
			{
				decision: "skipped",
				reason:
					"catalog total changed during the run: page 1 listed 3250, a later page 3251",
			},
		);
	});

	it("applies an empty removal, which closes an earlier held case", () => {
		assert.deepStrictEqual(planRemovals(survey({}), 0.05), {
			decision: "applied",
			ids: [],
		});
	});
});

const TestLive = Layer.mergeAll(OfferingStore.layer, RemovalStore.layer).pipe(
	Layer.provideMerge(ChangeLog.layer),
	Layer.provideMerge(TestDatabase(testDatabaseUrl)),
);

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

describe("removeOfferings", () => {
	layer(TestLive, { timeout: 30_000, excludeTestServices: true })((it) => {
		it.effect(
			"removes an offering its run no longer lists and restores it when it returns",
			() =>
				Effect.gen(function* () {
					yield* reset;

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
				yield* reset;

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
			"skips the removals of a run that saw fewer courses than page 1 listed",
			() =>
				Effect.gen(function* () {
					yield* reset;

					const sql = yield* SqlClient.SqlClient;
					const codes = ["935001", "935002", "935003"];

					yield* crawl(
						2035,
						codes.map((code) => ({ code })),
					);
					yield* parseOfferings("crawl");
					yield* removeOfferings(0.5);

					// Page 1 still counted 3 courses; a course left after it was
					// read, so 935003 moved onto a page the run had already read.
					const shifted = yield* crawl(
						2035,
						codes.slice(0, 2).map((code) => ({ code })),
						[3],
					);

					yield* removeOfferings(0.5);

					const [run] = yield* sql<{ readonly reason: string | null }>`
						SELECT report ->> 'removalsSkipped' AS reason FROM runs
						WHERE id = ${shifted}
					`;

					assert.strictEqual(yield* removalsOf(shifted), "skipped");
					assert.strictEqual(
						run?.reason,
						"catalog page 1 listed 3 courses, the run saw 2",
					);
					assert.isFalse((yield* offeringsOf(2035)).get("935003")?.removed);
				}),
		);

		it.effect(
			"skips the removals of a run whose catalog grew while it was read",
			() =>
				Effect.gen(function* () {
					yield* reset;

					const sql = yield* SqlClient.SqlClient;

					yield* crawl(2040, [
						{ code: "941001" },
						{ code: "941002" },
						{ code: "941003" },
					]);
					yield* parseOfferings("crawl");
					yield* removeOfferings(0.5);

					// 941004 arrived before page 2 was read and pushed 941003 past the
					// last page: the run saw as many codes as page 1 listed.
					const grown = yield* crawl(
						2040,
						[{ code: "941001" }, { code: "941002" }, { code: "941004" }],
						[3, 4],
					);

					yield* parseOfferings("crawl");
					yield* removeOfferings(0.5);

					const [run] = yield* sql<{ readonly reason: string | null }>`
						SELECT report ->> 'removalsSkipped' AS reason FROM runs
						WHERE id = ${grown}
					`;

					assert.strictEqual(yield* removalsOf(grown), "skipped");
					assert.strictEqual(
						run?.reason,
						"catalog total changed during the run: page 1 listed 3, a later page 4",
					);
					assert.isFalse((yield* offeringsOf(2040)).get("941003")?.removed);
				}),
		);

		it.effect(
			"holds removals above the threshold as one review case and publishes the rest",
			() =>
				Effect.gen(function* () {
					yield* reset;

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
					yield* reset;

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
	});
});
