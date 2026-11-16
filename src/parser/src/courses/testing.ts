import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { offeringRowsOf } from "../offerings/offerings.ts";
import { OfferingStore } from "../offerings/OfferingStore.ts";
import { NO_FILTERS, snapshot } from "../offerings/testing.ts";
import type { ParsedOffering } from "../saz/coursePage.ts";

/** Writes these offerings as a parse would, each from a new snapshot. */
export const write = (offerings: ReadonlyArray<ParsedOffering>) =>
	Effect.gen(function* () {
		const store = yield* OfferingStore;

		const pages = yield* Effect.forEach(offerings, (parsed) =>
			snapshot(
				`/course/${parsed.sazCode}`,
				`${parsed.title} ${parsed.department}`,
			).pipe(Effect.map((snapshotId) => ({ snapshotId, offering: parsed }))),
		);

		yield* store.write(
			offeringRowsOf(pages, NO_FILTERS, yield* store.programmes),
			yield* store.startParse("crawl"),
		);
	});

/** Each offering's course, by САЗ code. */
export interface Grouped {
	readonly sazCode: string;
	readonly courseId: string;
	readonly courseSource: string;
	readonly changeNo: bigint;
}

export const groups = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;

	return yield* sql<Grouped>`
		SELECT saz_code AS "sazCode", course_id AS "courseId",
			course_source AS "courseSource", change_no AS "changeNo"
		FROM offerings ORDER BY saz_code
	`;
});

export const courses = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;

	return yield* sql<{
		readonly id: string;
		readonly departmentId: string | null;
		readonly mergedInto: string | null;
		readonly mergeSource: string | null;
		readonly removed: boolean;
		readonly changeNo: bigint;
	}>`
		SELECT id, department_id AS "departmentId", merged_into AS "mergedInto",
			merge_source AS "mergeSource", removed_at IS NOT NULL AS removed, change_no AS "changeNo"
		FROM courses ORDER BY id
	`;
});

export const lastChange = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;

	const [row] = yield* sql<{ readonly n: bigint | null }>`
		SELECT max(change_no) AS n FROM changes
	`;

	return row?.n;
});
