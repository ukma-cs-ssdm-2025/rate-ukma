import { Context, Effect, Layer, Option, type Redacted, Schema } from "effect";
import { SqlClient, SqlSchema } from "effect/sql";
import { Audit } from "../audit/Audit.ts";
import { Scope } from "./scopes.ts";
import {
	formatToken,
	hashSecret,
	newSecret,
	parseToken,
	secretMatches,
} from "./token.ts";

export const DEFAULT_EXPIRY_DAYS = 365;

export interface NewKey {
	readonly name: string;
	readonly scopes: ReadonlyArray<Scope>;
	readonly expiresInDays: number;
	/** The key that asked for it; null on the command line. */
	readonly createdBy: string | null;
}

export interface IssuedKey {
	readonly id: string;
	/** Shown once and never stored. */
	readonly token: Redacted.Redacted<string>;
	readonly expiresAt: Date;
}

/** A key that is known, not revoked and not expired. */
export interface KeyHolder {
	readonly keyId: string;
	readonly scopes: ReadonlyArray<Scope>;
	readonly expiresAt: Date;
}

const KeyRow = Schema.Struct({
	id: Schema.String,
	name: Schema.String,
	scopes: Schema.Array(Scope),
	createdBy: Schema.NullOr(Schema.String),
	createdAt: Schema.Date,
	expiresAt: Schema.Date,
	revokedAt: Schema.NullOr(Schema.Date),
});

export type KeyRow = typeof KeyRow.Type;

export class Keys extends Context.Service<
	Keys,
	{
		create(key: NewKey): Effect.Effect<IssuedKey>;
		/** False when the key is unknown or already revoked. */
		revoke(id: string, by: string | null): Effect.Effect<boolean>;
		list: Effect.Effect<ReadonlyArray<KeyRow>>;
		authenticate(
			token: Redacted.Redacted<string>,
		): Effect.Effect<Option.Option<KeyHolder>>;
	}
>()("ukma-data/keys/Keys") {
	static readonly layer = Layer.effect(
		Keys,
		Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			const audit = yield* Audit;

			const insertKey = SqlSchema.findOne({
				Request: Schema.Struct({
					name: Schema.String,
					secretHash: Schema.String,
					scopes: Schema.Array(Scope),
					expiresInDays: Schema.Int,
					createdBy: Schema.NullOr(Schema.String),
				}),
				Result: Schema.Struct({ id: Schema.String, expiresAt: Schema.Date }),
				execute: (key) => sql`
					INSERT INTO api_keys (name, secret_hash, scopes, created_by, expires_at)
					VALUES (${key.name}, ${key.secretHash}, ${key.scopes}::text[], ${key.createdBy},
						now() + make_interval(days => ${key.expiresInDays}))
					RETURNING id, expires_at AS "expiresAt"
				`,
			});

			const create = (key: NewKey) =>
				Effect.gen(function* () {
					const secret = newSecret();

					const { id, expiresAt } = yield* insertKey({
						...key,
						secretHash: hashSecret(secret),
					});

					yield* audit.record({
						action: "key_created",
						keyId: key.createdBy,
						targetId: id,
					});

					return { id, token: formatToken(id, secret), expiresAt };
				}).pipe(sql.withTransaction, Effect.orDie);

			const revoke = (id: string, by: string | null) =>
				Effect.gen(function* () {
					const revoked = yield* sql`
						UPDATE api_keys SET revoked_at = now()
						WHERE id = ${id} AND revoked_at IS NULL
						RETURNING id
					`;

					if (revoked.length === 0) return false;

					yield* audit.record({
						action: "key_revoked",
						keyId: by,
						targetId: id,
					});

					return true;
				}).pipe(sql.withTransaction, Effect.orDie);

			const findKeys = SqlSchema.findAll({
				Request: Schema.Void,
				Result: KeyRow,
				execute: () => sql`
					SELECT id, name, scopes, created_by AS "createdBy",
						created_at AS "createdAt", expires_at AS "expiresAt",
						revoked_at AS "revokedAt"
					FROM api_keys
					ORDER BY created_at, id
				`,
			});

			const findValid = SqlSchema.findOneOption({
				Request: Schema.String,
				Result: Schema.Struct({
					scopes: Schema.Array(Scope),
					expiresAt: Schema.Date,
					secretHash: Schema.String,
				}),
				execute: (id) => sql`
					SELECT scopes, expires_at AS "expiresAt", secret_hash AS "secretHash"
					FROM api_keys
					WHERE id = ${id} AND revoked_at IS NULL AND expires_at > now()
				`,
			});

			const authenticate = (token: Redacted.Redacted<string>) =>
				Option.match(parseToken(token), {
					onNone: () => Effect.succeedNone,
					onSome: ({ keyId, secret }) =>
						findValid(keyId).pipe(
							Effect.map(
								Option.flatMap(({ scopes, expiresAt, secretHash }) =>
									secretMatches(secret, secretHash)
										? Option.some({ keyId, scopes, expiresAt })
										: Option.none(),
								),
							),
							Effect.orDie,
						),
				});

			return Keys.of({
				create,
				revoke,
				list: findKeys().pipe(Effect.orDie),
				authenticate,
			});
		}),
	);
}
