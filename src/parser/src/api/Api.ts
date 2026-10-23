import { Context, type Effect, Schema } from "effect";
import {
	HttpApi,
	HttpApiEndpoint,
	HttpApiError,
	HttpApiGroup,
	HttpApiMiddleware,
	HttpApiSchema,
	HttpApiSecurity,
} from "effect/http-api";
import { Scope } from "../keys/scopes.ts";

/** The key behind a request that passed `ApiKeyAuth`. */
export class Caller extends Context.Service<
	Caller,
	{
		readonly keyId: string;
		readonly scopes: ReadonlyArray<Scope>;
		readonly expiresAt: Date;
		/** Rows the response returns, for the audit row. */
		countRows(rows: number): Effect.Effect<void>;
	}
>()("ukma-data/api/Caller") {}

/** The scopes an endpoint behind `ApiKeyAuth` needs, all of them. An endpoint
 *  without this annotation refuses every key. */
export class RequiredScopes extends Context.Service<
	RequiredScopes,
	ReadonlyArray<Scope>
>()("ukma-data/api/RequiredScopes") {}

/** `Authorization: Bearer ukd_...`. An unknown, revoked or expired key or a
 *  wrong secret gets 401; a valid key without a required scope gets 403.
 *  Every request whose key exists writes one audit row, a refused one with
 *  its reason. */
export class ApiKeyAuth extends HttpApiMiddleware.Service<
	ApiKeyAuth,
	{ provides: Caller }
>()("ukma-data/api/ApiKeyAuth", {
	security: { bearer: HttpApiSecurity.bearer },
	error: [HttpApiError.Unauthorized, HttpApiError.Forbidden],
}) {}

export class SystemApi extends HttpApiGroup.make("system", {
	topLevel: true,
}).add(
	HttpApiEndpoint.get("health", "/health", {
		success: HttpApiSchema.Empty(200),
	}),
) {}

export const CurrentKey = Schema.Struct({
	id: Schema.String,
	scopes: Schema.Array(Scope),
	expiresAt: Schema.String,
});

export class KeyApi extends HttpApiGroup.make("key")
	.add(
		HttpApiEndpoint.get("current", "/key", { success: CurrentKey }).annotate(
			RequiredScopes,
			[],
		),
	)
	.middleware(ApiKeyAuth)
	.prefix("/v1") {}

export class Api extends HttpApi.make("ukma-data").add(SystemApi).add(KeyApi) {}
