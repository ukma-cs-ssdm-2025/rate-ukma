import { NodeServices } from "@effect/platform-node";
import { assert, describe, layer } from "@effect/vitest";
import { Effect, Exit, Layer, Redacted } from "effect";
import { Command } from "effect/cli";
import { SqlClient } from "effect/sql";
import { TestConsole } from "effect/testing";
import { Audit } from "../audit/Audit.ts";
import { TestDatabase, testDatabaseUrl } from "../db/testDatabase.ts";
import { keyCommands } from "./commands.ts";
import { Keys } from "./Keys.ts";
import { hashSecret } from "./token.ts";

const KeysTest = Keys.layer.pipe(Layer.provide(Audit.layer));

const cli = Command.make("ukma-data").pipe(
	Command.withSubcommands(keyCommands(KeysTest)),
);

/** Runs one command line and returns its exit and what it printed. */
const run = (args: ReadonlyArray<string>) =>
	Effect.gen(function* () {
		const exit = yield* Effect.exit(
			Command.runWith(cli, { version: "0.0.0" })(args),
		);

		const lines = (yield* TestConsole.logLines).map(String);

		return { exit, lines };
	}).pipe(Effect.provide(TestConsole.layer));

const TOKEN = /^ukd_(key_[0-9A-Z]{26})\.([A-Za-z0-9_-]{43})$/;

const created = (lines: ReadonlyArray<string>) => {
	const token = lines.find((line) => line.startsWith("ukd_")) ?? "";
	const match = TOKEN.exec(token);

	assert.isNotNull(match, "a token line");

	return { token, keyId: match?.[1] ?? "", secret: match?.[2] ?? "" };
};

/** `create-key --name <name> [flags]`, returning the printed token's parts. */
const newKey = (name: string, ...flags: ReadonlyArray<string>) =>
	run(["create-key", "--name", name, ...flags]).pipe(
		Effect.map(({ lines }) => created(lines)),
	);

const storedKey = (id: string) =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;

		const rows = yield* sql<{
			readonly name: string;
			readonly scopes: ReadonlyArray<string>;
			readonly secretHash: string;
			readonly createdBy: string | null;
			readonly revoked: boolean;
		}>`
			SELECT name, scopes, secret_hash AS "secretHash", created_by AS "createdBy",
				revoked_at IS NOT NULL AS revoked
			FROM api_keys WHERE id = ${id}
		`;

		return rows[0];
	});

const keyCount = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;

	const rows = yield* sql<{ readonly count: string }>`
		SELECT count(*)::text AS count FROM api_keys
	`;

	return rows[0]?.count;
});

const TestLive = KeysTest.pipe(
	Layer.provideMerge(NodeServices.layer),
	Layer.provideMerge(TestDatabase(testDatabaseUrl ?? "")),
);

describe.skipIf(testDatabaseUrl === undefined)("key commands", () => {
	layer(TestLive, { timeout: 30_000, excludeTestServices: true })((it) => {
		it.effect("create-key prints the token once and stores its hash", () =>
			Effect.gen(function* () {
				const { exit, lines } = yield* run([
					"create-key",
					"--name",
					"test reader",
					"--scope",
					"review:decide",
				]);

				assert.isTrue(Exit.isSuccess(exit));

				const { token, keyId, secret } = created(lines);

				assert.strictEqual(lines.length, 2);
				assert.match(
					lines[0] ?? "",
					new RegExp(`^${keyId} review:decide expires `),
				);
				assert.strictEqual(
					lines.filter((line) => line.includes(secret)).length,
					1,
				);

				const stored = yield* storedKey(keyId);

				assert.deepStrictEqual(stored, {
					name: "test reader",
					scopes: ["review:decide"],
					secretHash: hashSecret(secret),
					createdBy: null,
					revoked: false,
				});

				const keys = yield* Keys;
				const check = yield* keys.authenticate(Redacted.make(token));

				assert.strictEqual(check._tag, "Valid");
			}),
		);

		it.effect("create-key grants the defaults, or every scope", () =>
			Effect.gen(function* () {
				const defaults = yield* newKey("test reader");
				const all = yield* newKey("test team", "--all-scopes");

				assert.deepStrictEqual((yield* storedKey(defaults.keyId))?.scopes, [
					"catalog:read",
				]);
				assert.deepStrictEqual((yield* storedKey(all.keyId))?.scopes, [
					"catalog:read",
					"review:decide",
				]);
			}),
		);

		it.effect(
			"create-key refuses --scope with --all-scopes and stores nothing",
			() =>
				Effect.gen(function* () {
					const before = yield* keyCount;

					const { exit, lines } = yield* run([
						"create-key",
						"--name",
						"test team",
						"--all-scopes",
						"--scope",
						"catalog:read",
					]);

					assert.isTrue(Exit.isFailure(exit));
					assert.include(String(exit), "ScopesAndAllScopes");
					assert.deepStrictEqual(lines, []);
					assert.strictEqual(yield* keyCount, before);
				}),
		);

		it.effect("revoke-key revokes once, then refuses with UnknownKey", () =>
			Effect.gen(function* () {
				const { keyId } = yield* newKey("test reader");

				const first = yield* run(["revoke-key", keyId]);

				assert.isTrue(Exit.isSuccess(first.exit));
				assert.deepStrictEqual(first.lines, [`Revoked ${keyId}`]);
				assert.isTrue((yield* storedKey(keyId))?.revoked);

				for (const id of [keyId, "key_00000000000000000000000000"]) {
					const again = yield* run(["revoke-key", id]);

					assert.isTrue(Exit.isFailure(again.exit));
					assert.include(String(again.exit), "UnknownKey");
				}
			}),
		);

		it.effect("list-keys prints each key's status and never its hash", () =>
			Effect.gen(function* () {
				const sql = yield* SqlClient.SqlClient;

				const active = yield* newKey("test active");
				const revoked = yield* newKey("test revoked");
				const expired = yield* newKey("test expired");

				yield* run(["revoke-key", revoked.keyId]);
				yield* sql`
					UPDATE api_keys SET expires_at = now() - interval '1 second'
					WHERE id = ${expired.keyId}
				`;

				const { lines } = yield* run(["list-keys"]);

				const summaryOf = (keyId: string) => {
					const line = lines.find((each) => each.startsWith(`${keyId}\t`));
					const [, name, scopes, , status = ""] = (line ?? "").split("\t");

					return [name, scopes, status.split(" ")[0]];
				};

				assert.deepStrictEqual(summaryOf(active.keyId), [
					"test active",
					"catalog:read",
					"active",
				]);
				assert.deepStrictEqual(summaryOf(revoked.keyId), [
					"test revoked",
					"catalog:read",
					"revoked",
				]);
				assert.deepStrictEqual(summaryOf(expired.keyId), [
					"test expired",
					"catalog:read",
					"expired",
				]);

				for (const line of lines) {
					assert.notInclude(line, hashSecret(active.secret));
				}
			}),
		);
	});
});
