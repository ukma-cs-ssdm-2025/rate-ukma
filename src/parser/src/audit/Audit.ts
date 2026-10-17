import { Context, Effect, Layer, Schema } from "effect";
import { SqlClient } from "effect/sql";

export const AuditAction = Schema.Literals([
	"request",
	"request_denied",
	"key_created",
	"key_revoked",
]);

export type AuditAction = typeof AuditAction.Type;

/** Why a request was refused, on a `request_denied` row. */
export const DenialReason = Schema.Literals([
	"wrong_secret",
	"revoked",
	"expired",
	"missing_scope",
	"no_required_scopes",
]);

export type DenialReason = typeof DenialReason.Type;

/** Who did what, never with data values: a read records its row count. */
export interface AuditEntry {
	readonly action: AuditAction;
	/** Null for an action from the command line. */
	readonly keyId: string | null;
	/** The endpoint's method and path template, such as `GET /v1/offerings`. */
	readonly route?: string;
	readonly targetId?: string;
	readonly rowCount?: number;
	readonly reason?: DenialReason;
}

export class Audit extends Context.Service<
	Audit,
	{
		/** Inside the transaction of the action it records, when there is one. */
		record(entry: AuditEntry): Effect.Effect<void>;
	}
>()("ukma-data/audit/Audit") {
	static readonly layer = Layer.effect(
		Audit,
		Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;

			const record = (entry: AuditEntry) =>
				sql`
					INSERT INTO audit_log (key_id, action, route, target_id, row_count, reason)
					VALUES (${entry.keyId}, ${entry.action}, ${entry.route ?? null},
						${entry.targetId ?? null}, ${entry.rowCount ?? null}, ${entry.reason ?? null})
				`.pipe(Effect.asVoid, Effect.orDie);

			return Audit.of({ record });
		}),
	);
}
