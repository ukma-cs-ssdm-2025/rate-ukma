import { assert, describe, it, layer } from "@effect/vitest";
import { Effect, Exit, Layer, Result } from "effect";
import { SqlClient } from "effect/sql";
import { ChangeLog } from "../changes/ChangeLog.ts";
import { TestDatabase, testDatabaseUrl } from "../db/testing.ts";
import { coursePage } from "../saz/coursePage.fixture.ts";
import { parseCoursePage } from "../saz/coursePage.ts";
import { offering } from "./offering.fixture.ts";
import { OfferingStore } from "./OfferingStore.ts";
import {
	catalogFiltersOf,
	offeringRowsOf,
	parseOfferings,
	termCode,
} from "./offerings.ts";
import { crawl, offeringsOf, reset } from "./testing.ts";

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
	Layer.provideMerge(ChangeLog.layer),
	Layer.provideMerge(TestDatabase(testDatabaseUrl)),
);

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
					yield* store.startParse("crawl"),
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
					changes: [{ table: "offerings", action: "change", rows: 1 }],
				});
				assert.deepStrictEqual(yield* parses, [
					{ trigger: "crawl", finished: null, report: null },
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

describe("change tracking", () => {
	layer(TestLive, { timeout: 30_000, excludeTestServices: true })((it) => {
		it.effect(
			"numbers a row once per change, so a second parse takes no number",
			() =>
				Effect.gen(function* () {
					yield* reset;

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
			"keeps a department's faculty when cards in two batches disagree",
			() =>
				Effect.gen(function* () {
					yield* reset;

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
					yield* reset;

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

		it.effect(
			"takes no number for catalog filter ids that did not change, nor for a released one",
			() =>
				Effect.gen(function* () {
					yield* reset;

					const sql = yield* SqlClient.SqlClient;

					const runId = yield* crawl(2039, [
						{ code: "990001" },
						{ code: "990002", unit: MOVED_DEPARTMENT },
					]);

					const storeCatalog = (faculties: string, programmes: string) =>
						sql`
							INSERT INTO page_snapshots (path, kind, content_hash, content, run_id)
							VALUES (
								${`/course/catalog?year=2039&v=${faculties.length}`}, 'catalog',
								${`catalog ${faculties}`},
								${`<form><select name="filter[faculty][]" multiple>${faculties}</select><select name="filter[spec][]" multiple>${programmes}</select></form>`},
								${runId}
							)
						`;

					const PROGRAMME = `<option value="5001">Вигадана інженерія (Бакалавр)</option>`;

					yield* storeCatalog(
						`<option value="901">Факультет вигаданих наук</option>`,
						PROGRAMME,
					);

					yield* parseOfferings("crawl");

					const [programme] = yield* sql<{ readonly sazFilterId: string }>`
						SELECT saz_filter_id AS "sazFilterId" FROM programmes
						WHERE name = 'Вигадана інженерія' AND level = 'bachelor'
					`;

					assert.strictEqual(programme?.sazFilterId, "5001");
					assert.deepStrictEqual(
						(yield* parseOfferings("reparse")).changes,
						[],
					);

					// The filter id moves to the other faculty: the first one is
					// released, the second one takes it.
					yield* storeCatalog(
						`<option value="901">Факультет уявних мистецтв</option><option value="902">Факультет вигаданих наук</option>`,
						PROGRAMME,
					);

					const moved = yield* parseOfferings("reparse");

					assert.deepStrictEqual(moved.changes, [
						{ table: "faculties", action: "change", rows: 2 },
					]);
					assert.deepStrictEqual(
						(yield* parseOfferings("reparse")).changes,
						[],
					);

					const faculties = yield* sql<{ readonly line: string }>`
						SELECT name || ' ' || saz_filter_id AS line FROM faculties
						WHERE saz_filter_id IN ('901', '902') ORDER BY line
					`;

					assert.deepStrictEqual(
						faculties.map(({ line }) => line),
						["Факультет вигаданих наук 902", "Факультет уявних мистецтв 901"],
					);
				}),
		);
	});
});
