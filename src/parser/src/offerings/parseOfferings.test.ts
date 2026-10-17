import { assert, describe, layer } from "@effect/vitest";
import { Effect, Exit, Layer } from "effect";
import { SqlClient } from "effect/sql";
import { TestDatabase, testDatabaseUrl } from "../db/testDatabase.ts";
import { coursePage } from "../saz/coursePage.fixture.ts";
import { offering } from "./offering.fixture.ts";
import { OfferingStore } from "./OfferingStore.ts";
import { offeringRowsOf, parseOfferings } from "./offerings.ts";

const TestLive = OfferingStore.layer.pipe(
	Layer.provideMerge(TestDatabase(testDatabaseUrl ?? "")),
);

const reset = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;

	yield* sql`
		TRUNCATE offering_terms, offering_programmes, offerings, programmes,
			departments, faculties, terms, parse_failures, parses, page_snapshots,
			run_pages, runs
		RESTART IDENTITY
	`;
});

/** Stores a course page as the crawl would, and returns its snapshot id. */
const snapshot = (path: string, content: string) =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;

		const [run] = yield* sql<{ readonly id: bigint }>`
			INSERT INTO runs (source_part) VALUES ('saz-courses:2031-32') RETURNING id
		`;

		const [stored] = yield* sql<{ readonly id: bigint }>`
			INSERT INTO page_snapshots (path, kind, content_hash, content, run_id)
			VALUES (${path}, 'course', md5(${content}), ${content}, ${run?.id})
			RETURNING id
		`;

		assert.isDefined(stored);

		return stored.id;
	});

/** The offering's title, snapshot and terms, as one line. */
const offeringLine = (sazCode: string) =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;

		const [row] = yield* sql<{ readonly line: string }>`
			SELECT o.title || ' #' || o.snapshot_id || ' ' || string_agg(
				t.code || ' ' || ot.control, ', ' ORDER BY t.code
			) AS line
			FROM offerings o
			JOIN offering_terms ot ON ot.offering_id = o.id
			JOIN terms t ON t.id = ot.term_id
			WHERE o.saz_code = ${sazCode}
			GROUP BY o.id
		`;

		return row?.line;
	});

const parses = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;

	return yield* sql<{
		readonly trigger: string;
		readonly finished: boolean | null;
		readonly report: unknown;
	}>`
		SELECT trigger, finished_at >= started_at AS finished, report
		FROM parses ORDER BY id
	`;
});

const failures = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;

	return yield* sql<{ readonly line: string }>`
		SELECT parse_id || ' #' || snapshot_id || ' ' || path || ' ' || reason AS line
		FROM parse_failures ORDER BY parse_id, snapshot_id
	`.pipe(Effect.map((rows) => rows.map(({ line }) => line)));
});

const counts = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;

	const [row] = yield* sql<{ readonly line: string }>`
		SELECT (SELECT count(*) FROM runs) || ' runs, '
			|| (SELECT count(*) FROM page_snapshots) || ' snapshots' AS line
	`;

	return row?.line;
});

const NO_FILTERS = {
	faculties: new Map(),
	departments: new Map(),
	programmes: new Map(),
};

describe.skipIf(testDatabaseUrl === undefined)("reparse", () => {
	layer(TestLive, { timeout: 30_000, excludeTestServices: true })((it) => {
		it.effect("brings a parser fix to the tables without a crawl", () =>
			Effect.gen(function* () {
				yield* reset;

				const store = yield* OfferingStore;

				const page = yield* snapshot(
					"/course/900001",
					coursePage({ code: "900001" }),
				);

				// Rows an older parser wrote from the same snapshot: a cut title and
				// the wrong control.
				yield* store.write(
					offeringRowsOf(
						[
							{
								snapshotId: page,
								offering: offering("900001", { title: "Вступ" }),
							},
						],
						NO_FILTERS,
					),
				);

				const before = yield* counts;
				const report = yield* parseOfferings("reparse");

				assert.strictEqual(
					yield* offeringLine("900001"),
					"Вступ до вигаданих систем #1 2031-32-FALL exam",
				);
				assert.strictEqual(yield* counts, before);
				assert.deepStrictEqual(report, {
					seconds: report.seconds,
					parsed: 1,
					failed: [],
				});
				assert.deepStrictEqual(yield* parses, [
					{ trigger: "reparse", finished: true, report },
				]);
				assert.deepStrictEqual(yield* failures, []);
			}),
		);

		it.effect("records a failed page and keeps its last good rows", () =>
			Effect.gen(function* () {
				yield* reset;

				yield* snapshot("/course/900001", coursePage({ code: "900001" }));
				yield* snapshot("/course/900002", coursePage({ code: "900002" }));

				const first = yield* parseOfferings("crawl");

				yield* snapshot("/course/900001", "<html></html>");

				const report = yield* parseOfferings("reparse");

				assert.strictEqual(
					yield* offeringLine("900001"),
					"Вступ до вигаданих систем #1 2031-32-FALL exam",
				);
				assert.deepStrictEqual(yield* failures, [
					"2 #3 /course/900001 no course card",
				]);
				assert.strictEqual(first.parsed, 2);
				assert.deepStrictEqual(report.failed, [
					{ reason: "no course card", pages: 1 },
				]);
				assert.deepStrictEqual(
					(yield* parses).map(({ trigger, report }) => ({ trigger, report })),
					[
						{ trigger: "crawl", report: first },
						{ trigger: "reparse", report },
					],
				);
			}),
		);

		it.effect("records the pages of a batch the database rejects", () =>
			Effect.gen(function* () {
				yield* reset;

				const sql = yield* SqlClient.SqlClient;

				yield* snapshot("/course/900001", coursePage({ code: "900001" }));
				yield* parseOfferings("crawl");
				yield* snapshot(
					"/course/900001",
					coursePage({ code: "900001", title: "Вигадані системи, 2" }),
				);

				yield* sql`
					CREATE FUNCTION reject_offering() RETURNS trigger LANGUAGE plpgsql
					AS $$ BEGIN RAISE EXCEPTION 'rejected'; END $$
				`;
				yield* sql`
					CREATE TRIGGER reject_offering BEFORE INSERT OR UPDATE ON offerings
					FOR EACH ROW EXECUTE FUNCTION reject_offering()
				`;

				const report = yield* parseOfferings("reparse").pipe(
					Effect.ensuring(
						sql`DROP FUNCTION reject_offering CASCADE`.pipe(Effect.orDie),
					),
				);

				assert.strictEqual(
					yield* offeringLine("900001"),
					"Вступ до вигаданих систем #1 2031-32-FALL exam",
				);
				assert.deepStrictEqual(yield* failures, ["2 #2 /course/900001 store"]);
				assert.deepStrictEqual(report.failed, [{ reason: "store", pages: 1 }]);
			}),
		);

		it.effect("ties each failure to a known parse and snapshot", () =>
			Effect.gen(function* () {
				yield* reset;

				const sql = yield* SqlClient.SqlClient;
				const store = yield* OfferingStore;
				const page = yield* snapshot("/course/900001", "<html></html>");
				const parseId = yield* store.startParse("reparse");

				const unknownTrigger = yield* sql`
					INSERT INTO parses (trigger) VALUES ('manual')
				`.pipe(Effect.exit);

				const unknownSnapshot = yield* store
					.recordFailures(parseId, [
						{ snapshotId: page + 1n, path: "/course/900002", reason: "x" },
					])
					.pipe(Effect.exit);

				assert.isTrue(Exit.isFailure(unknownTrigger));
				assert.isTrue(Exit.isFailure(unknownSnapshot));
				assert.deepStrictEqual(yield* parses, [
					{ trigger: "reparse", finished: null, report: null },
				]);
			}),
		);
	});
});
