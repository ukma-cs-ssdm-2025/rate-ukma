import { assert } from "@effect/vitest";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import type { CatalogFilters } from "./offerings.ts";

export const NO_FILTERS: CatalogFilters = {
	faculties: new Map(),
	departments: new Map(),
	programmes: new Map(),
};

export const reset = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;

	yield* sql`
		TRUNCATE changes, offering_terms, offering_programmes, offerings, programmes,
			departments, faculties, terms, parse_failures, parses, page_snapshots,
			run_pages, runs
		RESTART IDENTITY
	`;
});

/** Stores a page as the crawl would, and returns its snapshot id. */
export const snapshot = (path: string, content: string) =>
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
