import { Effect } from "effect";
import { SqlClient } from "effect/sql";

/** smart.ukma API lists join the САЗ page kinds. */
export default Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;

	for (const table of ["page_snapshots", "run_pages"]) {
		yield* sql`
			ALTER TABLE ${sql(table)}
			DROP CONSTRAINT ${sql(`${table}_kind_check`)},
			ADD CONSTRAINT ${sql(`${table}_kind_check`)} CHECK (kind IN (
				'catalog', 'course', 'students',
				'smart_departments', 'smart_teachers', 'smart_disciplines', 'smart_teacher_disciplines'
			))
		`;
	}
});
