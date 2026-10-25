import { assert, describe, it, layer } from "@effect/vitest";
import { Effect, Exit, Layer } from "effect";
import { SqlClient } from "effect/sql";
import { TestDatabase, testDatabaseUrl } from "../db/testing.ts";
import { coursePage } from "../saz/coursePage.fixture.ts";
import { offering } from "./offering.fixture.ts";
import { OfferingStore } from "./OfferingStore.ts";
import { offeringRowsOf, parseOfferings, termCode } from "./offerings.ts";
import { NO_FILTERS, reset, snapshot } from "./testing.ts";

const FILTERS = {
	faculties: new Map([["Факультет вигаданих наук", "901"]]),
	departments: new Map<string, string>(),
	programmes: new Map([
		["Вигадана інженерія (Бакалавр)", "5001"],
		["Вигадана інженерія (Магістр)", "5002"],
	]),
};

describe("termCode", () => {
	it("names both calendar years and the season", () => {
		assert.strictEqual(termCode(2031, "SPRING"), "2031-32-SPRING");
	});
});

describe("offeringRowsOf", () => {
	const rows = offeringRowsOf(
		[
			{ snapshotId: 11n, offering: offering("900001") },
			{ snapshotId: 12n, offering: offering("900002", { level: "master" }) },
			{
				snapshotId: 13n,
				offering: offering("900003", {
					faculty: null,
					department: null,
					programmes: [],
					terms: [],
				}),
			},
		],
		FILTERS,
	);

	it("lists each reference row once, with its catalog filter value", () => {
		assert.deepStrictEqual(rows.faculties, [
			{ name: "Факультет вигаданих наук", sazFilterId: "901" },
		]);
		assert.deepStrictEqual(rows.departments, [
			{
				name: "Кафедра вигаданих систем",
				faculty: "Факультет вигаданих наук",
				sazFilterId: null,
			},
		]);
		assert.deepStrictEqual(rows.terms, [
			{ code: "2031-32-FALL", academicYear: 2031, season: "FALL" },
		]);
	});

	it("gives a department the faculty a card names, whatever the order", () => {
		const departments = offeringRowsOf(
			[
				{ snapshotId: 11n, offering: offering("900001") },
				{ snapshotId: 12n, offering: offering("900002", { faculty: null }) },
			],
			FILTERS,
		).departments;

		assert.deepStrictEqual(
			departments.map(({ faculty }) => faculty),
			["Факультет вигаданих наук"],
		);
	});

	it("keeps a programme name of two levels as two programmes", () => {
		assert.deepStrictEqual(rows.programmes, [
			{ name: "Вигадана інженерія", level: "bachelor", sazFilterId: "5001" },
			{ name: "Вигадана інженерія", level: "master", sazFilterId: "5002" },
		]);
		assert.deepStrictEqual(
			rows.offeringProgrammes.map(({ sazCode, level }) => [sazCode, level]),
			[
				["900001", "bachelor"],
				["900002", "master"],
			],
		);
	});

	it("takes a programme's level from the catalog when the card's level has none", () => {
		const { programmes, offeringProgrammes } = offeringRowsOf(
			[
				{
					snapshotId: 14n,
					offering: offering("900004", {
						level: "master",
						programmes: [{ name: "Уявна економіка", kind: "elective" }],
					}),
				},
			],
			{
				...FILTERS,
				programmes: new Map([["Уявна економіка (Бакалавр)", "5003"]]),
			},
		);

		assert.deepStrictEqual(programmes, [
			{ name: "Уявна економіка", level: "bachelor", sazFilterId: "5003" },
		]);
		assert.strictEqual(offeringProgrammes[0]?.level, "bachelor");
	});

	it("keeps a stored programme's level when the catalog lists neither", () => {
		const { programmes } = offeringRowsOf(
			[
				{
					snapshotId: 15n,
					offering: offering("900005", {
						level: "master",
						programmes: [{ name: "Уявна економіка", kind: "elective" }],
					}),
				},
			],
			{ ...FILTERS, programmes: new Map() },
			[{ name: "Уявна економіка", level: "bachelor" }],
		);

		assert.deepStrictEqual(programmes, [
			{ name: "Уявна економіка", level: "bachelor", sazFilterId: null },
		]);
	});

	it("keys child rows by САЗ code and term code", () => {
		assert.deepStrictEqual(
			rows.offerings.map(({ sazCode, snapshotId }) => [sazCode, snapshotId]),
			[
				["900001", "11"],
				["900002", "12"],
				["900003", "13"],
			],
		);
		assert.deepStrictEqual(
			rows.offeringTerms.map(({ sazCode, termCode: code, semesters }) => ({
				sazCode,
				code,
				semesters,
			})),
			[
				{ sazCode: "900001", code: "2031-32-FALL", semesters: [1] },
				{ sazCode: "900002", code: "2031-32-FALL", semesters: [1] },
			],
		);
	});
});

const TestLive = OfferingStore.layer.pipe(
	Layer.provideMerge(TestDatabase(testDatabaseUrl)),
);

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

describe("reparse", () => {
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

				const unknownParse = yield* store
					.recordFailures(parseId + 1n, [
						{ snapshotId: page, path: "/course/900001", reason: "x" },
					])
					.pipe(Effect.exit);

				assert.isTrue(Exit.isFailure(unknownTrigger));
				assert.isTrue(Exit.isFailure(unknownSnapshot));
				assert.isTrue(Exit.isFailure(unknownParse));
				assert.deepStrictEqual(yield* parses, [
					{ trigger: "reparse", finished: null, report: null },
				]);
			}),
		);
	});
});
