import { assert, describe, layer } from "@effect/vitest";
import { Effect, Layer, Logger, Redacted, References, Schema } from "effect";
import { HttpClientRequest, HttpServer } from "effect/http";
import {
	HttpApi,
	HttpApiBuilder,
	HttpApiEndpoint,
	HttpApiGroup,
	HttpApiMiddleware,
	HttpApiTest,
} from "effect/http-api";
import { SqlClient } from "effect/sql";
import { TestDatabase, testDatabaseUrl } from "../db/testDatabase.ts";
import { Keys } from "../keys/Keys.ts";
import type { Scope } from "../keys/scopes.ts";
import { Api, ApiKeyAuth, Caller, RequiredScopes } from "./Api.ts";
import { AuthLive, KeyApiHandlers } from "./http.ts";

/** Invented rows a protected route returns; none may reach the audit log. */
const NAMES = ["Test Student One", "Test Student Two", "Test Student Three"];

const Rows = Schema.Struct({ names: Schema.Array(Schema.String) });

class ProbeGroup extends HttpApiGroup.make("probe")
	.add(
		HttpApiEndpoint.get("catalog", "/catalog", { success: Rows }).annotate(
			RequiredScopes,
			["catalog:read"],
		),
		HttpApiEndpoint.get("students", "/students", { success: Rows }).annotate(
			RequiredScopes,
			["students:read"],
		),
		HttpApiEndpoint.get("unmarked", "/unmarked", { success: Rows }),
	)
	.middleware(ApiKeyAuth)
	.prefix("/v1/probe") {}

class ProbeApi extends HttpApi.make("probe").add(ProbeGroup) {}

const rowsFor = Effect.gen(function* () {
	const caller = yield* Caller;

	yield* caller.countRows(NAMES.length);

	return { names: NAMES };
});

const ProbeHandlers = HttpApiBuilder.group(ProbeApi, "probe", (handlers) =>
	handlers
		.handle("catalog", () => rowsFor)
		.handle("students", () => rowsFor)
		.handle("unmarked", () => rowsFor),
);

const logLines: Array<string> = [];

const CaptureLogs = Logger.layer([
	Logger.map(Logger.formatJson, (line) => {
		logLines.push(line);
	}),
]).pipe(Layer.provideMerge(Layer.succeed(References.MinimumLogLevel, "All")));

const TestLive = Layer.mergeAll(ProbeHandlers, KeyApiHandlers).pipe(
	Layer.provideMerge(AuthLive),
	Layer.provideMerge(Layer.mergeAll(HttpServer.layerServices, CaptureLogs)),
	Layer.provideMerge(TestDatabase(testDatabaseUrl ?? "")),
);

/** A client is bound to the client middleware present when it is made. */
const withToken = (token: Redacted.Redacted<string>) =>
	Effect.provide(
		HttpApiMiddleware.layerClient(ApiKeyAuth, ({ next, request }) =>
			next(HttpClientRequest.bearerToken(request, Redacted.value(token))),
		),
	);

const probeAs = (token: Redacted.Redacted<string>) =>
	HttpApiTest.groups(ProbeApi, ["probe"]).pipe(withToken(token));

const newKey = (scopes: ReadonlyArray<Scope>) =>
	Effect.gen(function* () {
		const keys = yield* Keys;

		return yield* keys.create({
			name: "test reader",
			scopes,
			expiresInDays: 30,
			createdBy: null,
		});
	});

const AuditRow = Schema.Struct({
	action: Schema.String,
	route: Schema.NullOr(Schema.String),
	target_id: Schema.NullOr(Schema.String),
	row_count: Schema.NullOr(Schema.Number),
	reason: Schema.NullOr(Schema.String),
});

const auditOf = (keyId: string) =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;

		const rows = yield* sql<{ readonly row: string }>`
			SELECT row_to_json(a)::text AS row FROM audit_log a
			WHERE key_id = ${keyId} ORDER BY at, id
		`;

		return yield* Effect.forEach(rows, ({ row }) =>
			Schema.decodeUnknownEffect(Schema.fromJsonString(AuditRow))(row).pipe(
				Effect.map((fields) => ({ ...fields, raw: row })),
			),
		);
	});

describe.skipIf(testDatabaseUrl === undefined)("ApiKeyAuth", () => {
	layer(TestLive, { timeout: 30_000, excludeTestServices: true })((it) => {
		it.effect("serves a key with the scope and writes one audit row", () =>
			Effect.gen(function* () {
				const key = yield* newKey(["catalog:read"]);
				const client = yield* probeAs(key.token);

				const body = yield* client.probe.catalog();

				assert.deepStrictEqual(body.names, NAMES);

				const audit = yield* auditOf(key.id);

				assert.deepStrictEqual(
					audit.map(({ action, route, target_id, row_count }) => ({
						action,
						route,
						target_id,
						row_count,
					})),
					[
						{
							action: "request",
							route: "GET /v1/probe/catalog",
							target_id: null,
							row_count: 3,
						},
					],
				);

				for (const name of NAMES) assert.notInclude(audit[0]?.raw, name);
			}),
		);

		it.effect("refuses a key without the scope with 403 and audits it", () =>
			Effect.gen(function* () {
				const key = yield* newKey(["catalog:read", "runs:read"]);
				const client = yield* probeAs(key.token);

				const error = yield* Effect.flip(client.probe.students());

				assert.strictEqual(error._tag, "Forbidden");
				assert.deepStrictEqual(
					(yield* auditOf(key.id)).map(({ action, route, reason }) => ({
						action,
						route,
						reason,
					})),
					[
						{
							action: "request_denied",
							route: "GET /v1/probe/students",
							reason: "missing_scope",
						},
					],
				);
			}),
		);

		it.effect("refuses every key on a route that names no scope", () =>
			Effect.gen(function* () {
				const key = yield* newKey([
					"catalog:read",
					"students:read",
					"keys:manage",
				]);

				const client = yield* probeAs(key.token);

				const error = yield* Effect.flip(client.probe.unmarked());

				assert.strictEqual(error._tag, "Forbidden");
				assert.deepStrictEqual(
					(yield* auditOf(key.id)).map(({ reason }) => reason),
					["no_required_scopes"],
				);
			}),
		);

		it.effect(
			"refuses a revoked, an expired and a wrong key with 401 and audits each",
			() =>
				Effect.gen(function* () {
					const sql = yield* SqlClient.SqlClient;
					const keys = yield* Keys;

					const revoked = yield* newKey(["catalog:read"]);
					const expired = yield* newKey(["catalog:read"]);
					const valid = yield* newKey(["catalog:read"]);

					assert.isTrue(yield* keys.revoke(revoked.id, null));
					assert.isFalse(yield* keys.revoke(revoked.id, null));
					yield* sql`
						UPDATE api_keys SET expires_at = now() - interval '1 second'
						WHERE id = ${expired.id}
					`;

					const wrongSecret = Redacted.make(
						`${Redacted.value(valid.token).slice(0, -4)}AAAA`,
					);

					for (const token of [revoked.token, expired.token, wrongSecret]) {
						const client = yield* probeAs(token);
						const error = yield* Effect.flip(client.probe.catalog());

						assert.strictEqual(error._tag, "Unauthorized");
					}

					for (const [key, reason] of [
						[revoked, "revoked"],
						[expired, "expired"],
						[valid, "wrong_secret"],
					] as const) {
						const audit = yield* auditOf(key.id);

						assert.deepStrictEqual(
							audit.map(({ action, route, row_count, reason }) => ({
								action,
								route,
								row_count,
								reason,
							})),
							[
								{
									action: "request_denied",
									route: "GET /v1/probe/catalog",
									row_count: null,
									reason,
								},
							],
						);

						const token = Redacted.value(key.token);

						assert.notInclude(
							audit[0]?.raw,
							token.slice(token.indexOf(".") + 1),
						);
					}

					assert.notInclude(
						(yield* auditOf(valid.id))[0]?.raw,
						Redacted.value(wrongSecret).slice(-43),
					);
					assert.deepStrictEqual(
						yield* sql`
							SELECT key_id AS "keyId" FROM audit_log
							WHERE action = 'key_revoked' AND target_id = ${revoked.id}
						`,
						[{ keyId: null }],
					);
				}),
		);

		it.effect(
			"refuses an unknown or malformed token with 401 and audits nothing",
			() =>
				Effect.gen(function* () {
					const sql = yield* SqlClient.SqlClient;
					const known = yield* newKey(["catalog:read"]);
					const secret = Redacted.value(known.token).slice(-43);

					const denied = sql<{ readonly count: string }>`
						SELECT count(*)::text AS count FROM audit_log
						WHERE action = 'request_denied'
					`;

					const before = yield* denied;

					for (const token of [
						`ukd_key_00000000000000000000000000.${secret}`,
						`ukd_${known.id}`,
						"",
					]) {
						const client = yield* probeAs(Redacted.make(token));
						const error = yield* Effect.flip(client.probe.catalog());

						assert.strictEqual(error._tag, "Unauthorized");
					}

					assert.deepStrictEqual(yield* denied, before);
					assert.deepStrictEqual(yield* auditOf(known.id), []);
				}),
		);

		it.effect("stores the hash, not the token, and audits the new key", () =>
			Effect.gen(function* () {
				const sql = yield* SqlClient.SqlClient;
				const key = yield* newKey(["catalog:read"]);
				const token = Redacted.value(key.token);
				const secret = token.slice(token.indexOf(".") + 1);

				const stored = yield* sql<{ readonly row: string }>`
					SELECT row_to_json(k)::text AS row FROM api_keys k WHERE id = ${key.id}
				`;

				assert.strictEqual(stored.length, 1);
				assert.notInclude(stored[0]?.row, secret);

				const created = yield* sql<{ readonly keyId: string | null }>`
					SELECT key_id AS "keyId" FROM audit_log
					WHERE action = 'key_created' AND target_id = ${key.id}
				`;

				assert.deepStrictEqual(created, [{ keyId: null }]);
			}),
		);

		it.effect("tells a key its id, scopes and expiry on GET /v1/key", () =>
			Effect.gen(function* () {
				const key = yield* newKey(["runs:read"]);

				const client = yield* HttpApiTest.groups(Api, ["key"]).pipe(
					withToken(key.token),
				);

				const current = yield* client.key.current();

				assert.deepStrictEqual(current, {
					id: key.id,
					scopes: ["runs:read"],
					expiresAt: key.expiresAt.toISOString(),
				});
			}),
		);

		it.effect("never logs a token or its secret", () =>
			Effect.gen(function* () {
				const keys = yield* Keys;
				const key = yield* newKey(["catalog:read"]);
				const client = yield* probeAs(key.token);

				yield* client.probe.catalog();
				yield* Effect.ignore(client.probe.students());
				yield* keys.revoke(key.id, null);
				yield* Effect.ignore(client.probe.catalog());
				yield* Effect.logDebug("probe done", { key: key.token });

				const token = Redacted.value(key.token);
				const secret = token.slice(token.indexOf(".") + 1);

				assert.isAbove(logLines.length, 0);

				for (const line of logLines) {
					assert.notInclude(line, secret);
					assert.notInclude(line, token);
				}
			}),
		);
	});
});
