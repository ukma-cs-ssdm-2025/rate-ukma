import { assert, describe, layer } from "@effect/vitest";
import { Effect, Exit, Layer } from "effect";
import { SqlClient } from "effect/sql";
import { TestDatabase, testDatabaseUrl } from "../db/testDatabase.ts";
import type { OfferingTerm, ParsedOffering } from "../saz/coursePage.ts";
import { coursePage } from "../saz/coursePage.fixture.ts";
import { offering } from "./offering.fixture.ts";
import { OfferingStore } from "./OfferingStore.ts";
import {
	type CatalogFilters,
	offeringRowsOf,
	parseOfferings,
} from "./offerings.ts";

const TestLive = OfferingStore.layer.pipe(
	Layer.provideMerge(TestDatabase(testDatabaseUrl ?? "")),
);

const NO_FILTERS: CatalogFilters = {
	faculties: new Map(),
	departments: new Map(),
	programmes: new Map(),
};

const SPRING: OfferingTerm = {
	season: "SPRING",
	semesters: [2],
	credits: 3,
	hoursPerWeek: 2,
	lectureHours: 14,
	seminarHours: 14,
	practiceHours: null,
	control: "exam",
};

const reset = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;

	yield* sql`
		TRUNCATE offering_terms, offering_programmes, offerings, programmes,
			departments, faculties, terms, parse_failures, parses, page_snapshots,
			run_pages, runs
		RESTART IDENTITY
	`;
});

/** Stores a page as the crawl would, and returns its snapshot id. */
const snapshot = (path: string, content: string) =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;

		const [run] = yield* sql<{ readonly id: bigint }>`
			INSERT INTO runs (source_part) VALUES ('saz-courses:2031-32') RETURNING id
		`;

		const [stored] = yield* sql<{ readonly id: bigint }>`
			INSERT INTO page_snapshots (path, kind, content_hash, content, run_id)
			VALUES (
				${path},
				${path.startsWith("/course/catalog") ? "catalog" : "course"},
				md5(${content}),
				${content},
				${run?.id}
			)
			RETURNING id
		`;

		assert.isDefined(stored);

		return stored.id;
	});

/** Writes these offerings, each parsed from a new snapshot of its page. */
const write = (
	offerings: ReadonlyArray<ParsedOffering>,
	filters = NO_FILTERS,
) =>
	Effect.gen(function* () {
		const store = yield* OfferingStore;

		const pages = yield* Effect.forEach(offerings, (parsed) =>
			snapshot(`/course/${parsed.sazCode}`, parsed.title).pipe(
				Effect.map((snapshotId) => ({ snapshotId, offering: parsed })),
			),
		);

		yield* store.write(offeringRowsOf(pages, filters, yield* store.programmes));

		return pages.map(({ snapshotId }) => snapshotId);
	});

const ids = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;

	return yield* sql<{ readonly id: string }>`
		SELECT id FROM offerings
		UNION ALL SELECT id FROM faculties
		UNION ALL SELECT id FROM departments
		UNION ALL SELECT id FROM programmes
		UNION ALL SELECT id FROM terms
		ORDER BY id
	`.pipe(Effect.map((rows) => rows.map(({ id }) => id)));
});

/** One line per term and programme of the offering, in a stable order. */
const childrenOf = (sazCode: string) =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;

		const rows = yield* sql<{ readonly line: string }>`
			SELECT 'term ' || t.code || ' ' || ot.control AS line
			FROM offering_terms ot
			JOIN offerings o ON o.id = ot.offering_id
			JOIN terms t ON t.id = ot.term_id
			WHERE o.saz_code = ${sazCode}
			UNION ALL
			SELECT 'programme ' || p.name || ' ' || op.kind
			FROM offering_programmes op
			JOIN offerings o ON o.id = op.offering_id
			JOIN programmes p ON p.id = op.programme_id
			WHERE o.saz_code = ${sazCode}
			ORDER BY line
		`;

		return rows.map(({ line }) => line);
	});

const offeringRow = (sazCode: string) =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;

		const [row] = yield* sql<{
			readonly title: string;
			readonly snapshotId: bigint;
		}>`
			SELECT title, snapshot_id AS "snapshotId" FROM offerings
			WHERE saz_code = ${sazCode}
		`;

		return row;
	});

describe.skipIf(testDatabaseUrl === undefined)("OfferingStore", () => {
	layer(TestLive, { timeout: 30_000, excludeTestServices: true })((it) => {
		it.effect("gives each row a prefixed ULID and requires a level", () =>
			Effect.gen(function* () {
				yield* reset;

				const sql = yield* SqlClient.SqlClient;

				yield* write([offering("900001")]);

				const prefixes = (yield* ids).map((id) =>
					id.replace(/^([a-z]{3})_[0-9A-HJKMNP-TV-Z]{26}$/u, "$1"),
				);

				const nullLevel = yield* sql`
					INSERT INTO programmes (name, level) VALUES ('Вигадана логіка', NULL)
				`.pipe(Effect.exit);

				assert.deepStrictEqual(prefixes.sort(), [
					"dep",
					"fac",
					"off",
					"prg",
					"trm",
				]);
				assert.isTrue(Exit.isFailure(nullLevel));
			}),
		);

		it.effect("upserts by САЗ code and name, so ids stay", () =>
			Effect.gen(function* () {
				yield* reset;

				yield* write([offering("900001")]);

				const before = yield* ids;

				const [newer] = yield* write([
					offering("900001", { title: "Вступ до вигаданих систем, 2" }),
				]);

				assert.deepStrictEqual(yield* ids, before);
				assert.deepStrictEqual(yield* offeringRow("900001"), {
					title: "Вступ до вигаданих систем, 2",
					snapshotId: newer,
				});
			}),
		);

		it.effect("lets two faculties swap filter ids in one batch", () =>
			Effect.gen(function* () {
				yield* reset;

				const sql = yield* SqlClient.SqlClient;

				const offerings = [
					offering("900001"),
					offering("900002", { faculty: "Факультет уявних мистецтв" }),
				];

				const filters = (first: string, second: string): CatalogFilters => ({
					...NO_FILTERS,
					faculties: new Map([
						["Факультет вигаданих наук", first],
						["Факультет уявних мистецтв", second],
					]),
				});

				yield* write(offerings, filters("901", "902"));
				yield* write(offerings, filters("902", "901"));

				const rows = yield* sql<{ readonly line: string }>`
					SELECT saz_filter_id || ' ' || name AS line FROM faculties ORDER BY line
				`;

				assert.deepStrictEqual(
					rows.map(({ line }) => line),
					["901 Факультет уявних мистецтв", "902 Факультет вигаданих наук"],
				);
			}),
		);

		it.effect(
			"writes a renamed faculty beside pages that show its old name",
			() =>
				Effect.gen(function* () {
					yield* reset;

					const sql = yield* SqlClient.SqlClient;

					const filters = (name: string): CatalogFilters => ({
						...NO_FILTERS,
						faculties: new Map([[name, "901"]]),
					});

					yield* write(
						[offering("900001", { faculty: "Факультет уявних наук" })],
						filters("Факультет уявних наук"),
					);
					yield* write(
						[
							offering("900001", { faculty: "Факультет уявних наук" }),
							offering("900002", { faculty: "Факультет нових наук" }),
						],
						filters("Факультет нових наук"),
					);

					const rows = yield* sql<{ readonly line: string }>`
					SELECT coalesce(saz_filter_id, '-') || ' ' || name AS line
					FROM faculties ORDER BY name
				`;

					assert.deepStrictEqual(
						rows.map(({ line }) => line),
						["901 Факультет нових наук", "- Факультет уявних наук"],
					);
				}),
		);

		it.effect("replaces the terms and programmes of the batch only", () =>
			Effect.gen(function* () {
				yield* reset;

				yield* write([
					offering("900001", {
						terms: [...offering("900001").terms, SPRING],
						programmes: [
							{ name: "Вигадана інженерія", kind: "compulsory" },
							{ name: "Уявна фізика", kind: "elective" },
						],
					}),
					offering("900002"),
				]);

				yield* write([
					offering("900001", {
						terms: [SPRING],
						programmes: [{ name: "Вигадана логіка", kind: "prof_oriented" }],
					}),
				]);

				assert.deepStrictEqual(yield* childrenOf("900001"), [
					"programme Вигадана логіка prof_oriented",
					"term 2031-32-SPRING exam",
				]);
				assert.deepStrictEqual(yield* childrenOf("900002"), [
					"programme Вигадана інженерія compulsory",
					"term 2031-32-FALL pass_fail",
				]);
			}),
		);

		it.effect("keeps the rows of a newer snapshot over an older one", () =>
			Effect.gen(function* () {
				yield* reset;

				const store = yield* OfferingStore;
				const older = yield* snapshot("/course/900001", "older");
				const newer = yield* snapshot("/course/900001", "newer");

				const rowsOf = (snapshotId: bigint, parsed: ParsedOffering) =>
					offeringRowsOf([{ snapshotId, offering: parsed }], NO_FILTERS);

				yield* store.write(
					rowsOf(
						newer,
						offering("900001", { title: "Нова назва", terms: [SPRING] }),
					),
				);
				yield* store.write(
					rowsOf(older, offering("900001", { title: "Стара назва" })),
				);

				assert.deepStrictEqual(yield* offeringRow("900001"), {
					title: "Нова назва",
					snapshotId: newer,
				});
				assert.deepStrictEqual(yield* childrenOf("900001"), [
					"programme Вигадана інженерія compulsory",
					"term 2031-32-SPRING exam",
				]);
			}),
		);
	});
});

const CATALOG = `<form>
<select name="filter[faculty][]" multiple>
<option value="901">Факультет вигаданих наук</option>
</select>
<select name="filter[spec][]" multiple>
<option value="5001">Вигадана інженерія (Бакалавр)</option>
</select>
</form>`;

describe.skipIf(testDatabaseUrl === undefined)("parseOfferings", () => {
	layer(TestLive, { timeout: 30_000, excludeTestServices: true })((it) => {
		it.effect("parses the latest snapshot of each page with catalog ids", () =>
			Effect.gen(function* () {
				yield* reset;

				const sql = yield* SqlClient.SqlClient;

				yield* snapshot("/course/catalog?page=1", CATALOG);
				yield* snapshot("/course/900001", coursePage({ code: "900001" }));
				yield* snapshot(
					"/course/900001",
					coursePage({ code: "900001", title: "Вигадані системи, 2" }),
				);
				yield* snapshot("/course/900002", coursePage({ code: "900002" }));
				yield* snapshot("/course/900003", "<html></html>");

				const report = yield* parseOfferings("crawl");

				const rows = yield* sql<{ readonly line: string }>`
					SELECT o.saz_code || ' ' || o.title || ' ' || f.saz_filter_id AS line
					FROM offerings o JOIN faculties f ON f.id = o.faculty_id
					ORDER BY line
				`;

				const [programme] = yield* sql<{ readonly sazFilterId: string }>`
					SELECT saz_filter_id AS "sazFilterId" FROM programmes
				`;

				assert.deepStrictEqual(report, {
					seconds: report.seconds,
					parsed: 2,
					failed: [{ reason: "no course card", pages: 1 }],
				});
				assert.deepStrictEqual(
					rows.map(({ line }) => line),
					[
						"900001 Вигадані системи, 2 901",
						"900002 Вступ до вигаданих систем 901",
					],
				);
				assert.strictEqual(programme?.sazFilterId, "5001");
			}),
		);

		it.effect(
			"keeps a page's last good rows when its newer snapshot fails",
			() =>
				Effect.gen(function* () {
					yield* reset;

					yield* snapshot("/course/900001", coursePage({ code: "900001" }));
					yield* parseOfferings("crawl");

					const before = yield* offeringRow("900001");

					yield* snapshot("/course/900001", "<html></html>");

					const report = yield* parseOfferings("crawl");

					assert.deepStrictEqual(report.failed, [
						{ reason: "no course card", pages: 1 },
					]);
					assert.deepStrictEqual(yield* offeringRow("900001"), before);
					assert.deepStrictEqual(yield* childrenOf("900001"), [
						"programme Вигадана інженерія compulsory",
						"term 2031-32-FALL exam",
					]);
				}),
		);
	});
});
