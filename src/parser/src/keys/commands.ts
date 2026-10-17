import { Clock, Console, Effect, Layer, Redacted, Schema } from "effect";
import { Argument, Command, Flag } from "effect/cli";
import { Audit } from "../audit/Audit.ts";
import { PgLive } from "../db/Database.ts";
import { DEFAULT_EXPIRY_DAYS, type KeyRow, Keys } from "./Keys.ts";
import { DEFAULT_SCOPES, SCOPES } from "./scopes.ts";

/** `Keys` on the database of `DATABASE_URL`, for the container commands. */
export const KeysLive = Keys.layer.pipe(
	Layer.provide(Audit.layer),
	Layer.provide(PgLive),
);

export class UnknownKey extends Schema.TaggedError<UnknownKey>()("UnknownKey", {
	id: Schema.String,
}) {
	override get message() {
		return `No active key ${this.id}`;
	}
}

export class ScopesAndAllScopes extends Schema.TaggedError<ScopesAndAllScopes>()(
	"ScopesAndAllScopes",
	{},
) {
	override get message() {
		return "Pass --scope or --all-scopes, not both";
	}
}

/** One line of `list-keys`: never the hash. */
export const describeKey = (key: KeyRow, now: number): string => {
	const status =
		key.revokedAt !== null
			? `revoked ${key.revokedAt.toISOString()}`
			: key.expiresAt.getTime() <= now
				? "expired"
				: "active";

	return [
		key.id,
		key.name,
		key.scopes.join(","),
		`expires ${key.expiresAt.toISOString()}`,
		status,
	].join("\t");
};

const createKey = Command.make(
	"create-key",
	{
		name: Flag.String("name").pipe(
			Flag.withSchema(Schema.NonEmptyString),
			Flag.withDescription("Who holds the key, such as the reader's name"),
		),
		scopes: Flag.Literals("scope", SCOPES).pipe(
			Flag.atLeast(0),
			Flag.withDescription(
				`A scope; repeat for more. Without one: ${DEFAULT_SCOPES.join(", ")}`,
			),
		),
		allScopes: Flag.Boolean("all-scopes").pipe(
			Flag.withDescription("Every scope, for the team's own key"),
			Flag.withDefault(false),
		),
		expiresInDays: Flag.Int("expires-in-days").pipe(
			Flag.withSchema(
				Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 3650 })),
			),
			Flag.withDescription(
				`Days until the key stops working, ${DEFAULT_EXPIRY_DAYS} by default`,
			),
			Flag.withDefault(DEFAULT_EXPIRY_DAYS),
		),
	},
	({ name, scopes, allScopes, expiresInDays }) =>
		Effect.gen(function* () {
			if (allScopes && scopes.length > 0) {
				return yield* new ScopesAndAllScopes();
			}

			const keys = yield* Keys;

			const granted = allScopes
				? SCOPES
				: scopes.length > 0
					? scopes
					: DEFAULT_SCOPES;

			const key = yield* keys.create({
				name,
				scopes: granted,
				expiresInDays,
				createdBy: null,
			});

			yield* Console.log(
				`${key.id} ${granted.join(",")} expires ${key.expiresAt.toISOString()}`,
			);
			// Printed once to stdout and never logged: logs go to Sentry.
			yield* Console.log(Redacted.value(key.token));
		}),
).pipe(Command.withDescription("Make an API key and print its token once"));

const revokeKey = Command.make(
	"revoke-key",
	{ id: Argument.String("id").pipe(Argument.withDescription("key_...")) },
	({ id }) =>
		Effect.gen(function* () {
			const keys = yield* Keys;

			if (!(yield* keys.revoke(id, null))) {
				return yield* new UnknownKey({ id });
			}

			yield* Console.log(`Revoked ${id}`);
		}),
).pipe(Command.withDescription("Revoke an API key"));

const listKeys = Command.make("list-keys", {}, () =>
	Effect.gen(function* () {
		const keys = yield* Keys;
		const now = yield* Clock.currentTimeMillis;

		for (const key of yield* keys.list) {
			yield* Console.log(describeKey(key, now));
		}
	}),
).pipe(Command.withDescription("List API keys with their scopes and status"));

/** The key commands with `Keys` from `keys`: `KeysLive` in the container, a
 *  test database in tests. */
export const keyCommands = <E, R>(keys: Layer.Layer<Keys, E, R>) =>
	[
		createKey.pipe(Command.provide(keys)),
		revokeKey.pipe(Command.provide(keys)),
		listKeys.pipe(Command.provide(keys)),
	] as const;
