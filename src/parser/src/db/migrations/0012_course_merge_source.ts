import { Effect } from "effect";
import { SqlClient } from "effect/sql";

export default Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;

	// Who merged the course: the department handoff rule, which undoes its own
	// merge when the handoff stops holding, or a staff decision, which it never
	// undoes.
	yield* sql`
		ALTER TABLE courses ADD COLUMN merge_source text
			CHECK (merge_source IN ('rule', 'decision'))
	`;

	// No code merged a course before this column; one merged by hand was staff.
	yield* sql`
		UPDATE courses SET merge_source = 'decision' WHERE merged_into IS NOT NULL
	`;

	yield* sql`
		ALTER TABLE courses ADD CONSTRAINT courses_merge_source
			CHECK ((merged_into IS NULL) = (merge_source IS NULL))
	`;
});
