import { Effect } from "effect";
import { SqlClient } from "effect/sql";

export default Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;

	yield* sql`
		CREATE TABLE runs (
			id bigserial PRIMARY KEY,
			source_part text NOT NULL,
			status text NOT NULL DEFAULT 'running'
				CHECK (status IN ('running', 'succeeded', 'failed')),
			started_at timestamptz NOT NULL DEFAULT now(),
			finished_at timestamptz,
			report jsonb
		)
	`;

	yield* sql`
		CREATE TABLE page_snapshots (
			id bigserial PRIMARY KEY,
			path text NOT NULL,
			kind text NOT NULL CHECK (kind IN ('catalog', 'course', 'students')),
			content_hash text NOT NULL,
			content text NOT NULL,
			run_id bigint NOT NULL REFERENCES runs (id),
			fetched_at timestamptz NOT NULL DEFAULT now()
		)
	`;
	yield* sql`CREATE INDEX page_snapshots_latest ON page_snapshots (path, id DESC)`;

	yield* sql`
		CREATE TABLE run_pages (
			id bigserial PRIMARY KEY,
			run_id bigint NOT NULL REFERENCES runs (id),
			kind text NOT NULL CHECK (kind IN ('catalog', 'course', 'students')),
			path text NOT NULL,
			status text NOT NULL DEFAULT 'pending'
				CHECK (status IN ('pending', 'claimed', 'done', 'failed')),
			attempts integer NOT NULL DEFAULT 0,
			error text,
			snapshot_id bigint REFERENCES page_snapshots (id),
			claimed_at timestamptz,
			finished_at timestamptz,
			UNIQUE (run_id, path)
		)
	`;
	yield* sql`
		CREATE INDEX run_pages_pending ON run_pages (run_id, id) WHERE status = 'pending'
	`;
});
