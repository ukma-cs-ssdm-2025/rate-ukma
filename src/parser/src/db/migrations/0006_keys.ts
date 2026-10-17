import { Effect } from "effect";
import { SqlClient } from "effect/sql";

export default Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;

	// The scope list is copied, not imported from `keys/scopes.ts`: a new scope
	// needs a migration that widens this check.
	yield* sql`
		CREATE TABLE api_keys (
			id text PRIMARY KEY DEFAULT 'key_' || ulid(),
			name text NOT NULL,
			secret_hash text NOT NULL,
			scopes text[] NOT NULL CHECK (
				cardinality(scopes) > 0 AND scopes <@ ARRAY[
					'catalog:read', 'runs:read', 'instructors:read', 'students:read',
					'runs:start', 'review:decide', 'snapshots:read', 'audit:read',
					'keys:manage'
				]
			),
			created_by text REFERENCES api_keys (id),
			created_at timestamptz NOT NULL DEFAULT now(),
			expires_at timestamptz NOT NULL,
			revoked_at timestamptz
		)
	`;

	// `key_id` is null for an action from the command line. `route` is the
	// endpoint's path template, so it holds no ids or filter values. `reason`
	// says why a `request_denied` row was refused.
	yield* sql`
		CREATE TABLE audit_log (
			id text PRIMARY KEY DEFAULT 'aud_' || ulid(),
			at timestamptz NOT NULL DEFAULT now(),
			key_id text REFERENCES api_keys (id),
			staff_user text,
			action text NOT NULL CHECK (action IN (
				'request', 'request_denied', 'key_created', 'key_revoked',
				'run_started', 'decision_made', 'students_read', 'snapshots_read'
			)),
			route text,
			target_id text,
			row_count integer,
			reason text CHECK (reason IN (
				'wrong_secret', 'revoked', 'expired', 'missing_scope',
				'no_required_scopes'
			))
		)
	`;
	yield* sql`CREATE INDEX audit_log_key ON audit_log (key_id, at)`;
});
