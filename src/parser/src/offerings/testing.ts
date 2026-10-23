import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { sourcePartOf } from "../crawl/crawl.ts";
import { catalogPath } from "../saz/catalog.ts";
import { coursePage } from "../saz/coursePage.fixture.ts";

/** Empties every table the crawl, the parse and the removals write. */
export const reset = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;

	yield* sql`
		TRUNCATE changes, review_cases, enrollment_lists, enrollments,
			student_programmes, students, offering_terms, offering_programmes,
			offerings, programmes, departments, faculties, terms, parse_failures,
			parses, page_snapshots, run_pages, runs
		RESTART IDENTITY
	`;
});

export interface Listed {
	readonly code: string;
	readonly title?: string;
	readonly unit?: ReadonlyArray<string>;
	readonly failed?: boolean;
}

/** The latest snapshot of a path, or a new one when its content changed, as
 *  the crawl dedupes them. */
const snapshotOf = (
	runId: bigint,
	path: string,
	kind: "catalog" | "course",
	content: string,
) =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;

		const [latest] = yield* sql<{
			readonly id: bigint;
			readonly content: string;
		}>`
			SELECT id, content FROM page_snapshots
			WHERE path = ${path} ORDER BY id DESC LIMIT 1
		`;

		if (latest?.content === content) return latest.id;

		const [stored] = yield* sql<{ readonly id: bigint }>`
			INSERT INTO page_snapshots (path, kind, content_hash, content, run_id)
			VALUES (${path}, ${kind}, ${`hash ${content.length}`}, ${content}, ${runId})
			RETURNING id
		`;

		return stored?.id ?? 0n;
	});

/** Stores a finished run of one year that lists these courses, and returns
 *  its id. `totals` are the course totals its catalog pages reported, page 1
 *  first; they differ from the listed courses when the catalog changed during
 *  the run. */
export const crawl = (
	year: number,
	listed: ReadonlyArray<Listed>,
	totals = [listed.length],
) =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;

		const [run] = yield* sql<{ readonly id: bigint }>`
			INSERT INTO runs (source_part, status, finished_at)
			VALUES (${sourcePartOf(year)}, 'succeeded', now())
			RETURNING id
		`;

		const runId = run?.id ?? 0n;

		for (const [index, total] of totals.entries()) {
			const path = catalogPath(year, index + 1);

			const snapshotId = yield* snapshotOf(
				runId,
				path,
				"catalog",
				`<div class="summary">Показані <b>1-${total}</b> із <b>${total}</b> записів.</div>`,
			);

			yield* sql`
				INSERT INTO run_pages (run_id, kind, path, status, snapshot_id, finished_at)
				VALUES (${runId}, 'catalog', ${path}, 'done', ${snapshotId}, now())
			`;
		}

		for (const { code, title, unit, failed = false } of listed) {
			const path = `/course/${code}`;

			if (failed) {
				yield* sql`
					INSERT INTO run_pages (run_id, kind, path, status, error, finished_at)
					VALUES (${runId}, 'course', ${path}, 'failed', 'HTTP 500', now())
				`;
				continue;
			}

			const snapshotId = yield* snapshotOf(
				runId,
				path,
				"course",
				coursePage({ code, title, unit, year: `${year}–${year + 1}` }),
			);

			yield* sql`
				INSERT INTO run_pages (run_id, kind, path, status, snapshot_id, finished_at)
				VALUES (${runId}, 'course', ${path}, 'done', ${snapshotId}, now())
			`;
		}

		return runId;
	});

export interface StoredOffering {
	readonly id: string;
	readonly changeNo: bigint;
	readonly removed: boolean;
}

/** A year's offerings by САЗ code. */
export const offeringsOf = (year: number) =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;

		const rows = yield* sql<StoredOffering & { readonly sazCode: string }>`
			SELECT id, saz_code AS "sazCode", change_no AS "changeNo",
				removed_at IS NOT NULL AS removed
			FROM offerings WHERE academic_year = ${year}
		`;

		return new Map(rows.map(({ sazCode, ...row }) => [sazCode, row]));
	});
