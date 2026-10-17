import { Effect } from "effect";
import { SqlClient } from "effect/sql";

export default Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;

	yield* sql`
		CREATE TABLE parses (
			id bigserial PRIMARY KEY,
			trigger text NOT NULL CHECK (trigger IN ('crawl', 'reparse')),
			started_at timestamptz NOT NULL DEFAULT now(),
			finished_at timestamptz,
			report jsonb
		)
	`;

	yield* sql`
		CREATE TABLE parse_failures (
			parse_id bigint NOT NULL REFERENCES parses (id),
			snapshot_id bigint NOT NULL REFERENCES page_snapshots (id),
			path text NOT NULL,
			reason text NOT NULL,
			PRIMARY KEY (parse_id, snapshot_id)
		)
	`;
});
