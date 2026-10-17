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

const TestLive = OfferingStore.layer.pipe(
	Layer.provideMerge(ChangeLog.layer),
	Layer.provideMerge(TestDatabase(testDatabaseUrl ?? "")),
);

interface Listed {
	readonly code: string;
	readonly title?: string;
	readonly unit?: ReadonlyArray<string>;
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

		for (const { code, title, unit } of listed) {
			const path = `/course/${code}`;

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
}

const offeringsOf = (year: number) =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;

		const rows = yield* sql<StoredOffering & { readonly sazCode: string }>`
			SELECT id, saz_code AS "sazCode", change_no AS "changeNo"
			FROM offerings WHERE academic_year = ${year}
		`;

		return new Map(rows.map(({ sazCode, ...row }) => [sazCode, row]));
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

		it.effect(
			"takes no number for catalog filter ids that did not change, nor for a released one",
			() =>
				Effect.gen(function* () {
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
