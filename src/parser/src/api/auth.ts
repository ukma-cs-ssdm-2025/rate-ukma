import { Context, Effect, Layer, Option, Ref } from "effect";
import { HttpApiError } from "effect/http-api";
import { Audit } from "../audit/Audit.ts";
import { Keys } from "../keys/Keys.ts";
import { missingScopes } from "../keys/scopes.ts";
import { ApiKeyAuth, Caller, RequiredScopes } from "./Api.ts";

export const ApiKeyAuthLive = Layer.effect(
	ApiKeyAuth,
	Effect.gen(function* () {
		const keys = yield* Keys;
		const audit = yield* Audit;

		return ApiKeyAuth.of({
			bearer: Effect.fnUntraced(function* (
				httpEffect,
				{ credential, endpoint },
			) {
				const holder = yield* keys.authenticate(credential);

				if (Option.isNone(holder)) {
					return yield* new HttpApiError.Unauthorized({});
				}

				const { keyId, scopes, expiresAt } = holder.value;
				const route = `${endpoint.method} ${endpoint.path}`;

				const required = Context.getOption(
					endpoint.annotations,
					RequiredScopes,
				);

				if (
					Option.isNone(required) ||
					missingScopes(scopes, required.value).length > 0
				) {
					yield* audit.record({ action: "request_denied", keyId, route });

					return yield* new HttpApiError.Forbidden({});
				}

				const rows = yield* Ref.make<number | undefined>(undefined);

				const exit = yield* httpEffect.pipe(
					Effect.provideService(
						Caller,
						Caller.of({
							keyId,
							scopes,
							expiresAt,
							countRows: (count) => Ref.set(rows, count),
						}),
					),
					Effect.exit,
				);

				// Written before the response leaves: when the audit row cannot be
				// written, the caller gets a 500, not the data.
				yield* audit.record({
					action: "request",
					keyId,
					route,
					rowCount: yield* Ref.get(rows),
				});

				return yield* exit;
			}),
		});
	}),
);
