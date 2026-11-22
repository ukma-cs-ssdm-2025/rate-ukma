import { Context, Effect, Layer, Option, Ref } from "effect";
import { HttpApiError } from "effect/http-api";
import { Audit } from "../audit/Audit.ts";
import { KeyCheck, Keys } from "../keys/Keys.ts";
import { missingScopes } from "../keys/scopes.ts";
import {
	ApiKeyAuth,
	Caller,
	RequiredAnyScopes,
	RequiredScopes,
} from "./Api.ts";

export const ApiKeyAuthLive = Layer.effect(
	ApiKeyAuth,
	Effect.gen(function* () {
		const keys = yield* Keys;
		const audit = yield* Audit;

		return ApiKeyAuth.of({
			// oxlint-disable-next-line anti-slop-effect/require-named-effect-fn -- the server span covers the request and the check has ApiKeyAuth.check.
			bearer: Effect.fnUntraced(function* (
				httpEffect,
				{ credential, endpoint },
			) {
				const check = yield* keys.authenticate(credential).pipe(
					Effect.tap((result) =>
						Effect.annotateCurrentSpan("outcome", result._tag),
					),
					Effect.withSpan("ApiKeyAuth.check"),
				);

				const route = `${endpoint.method} ${endpoint.path}`;

				if (KeyCheck.$is("Denied")(check)) {
					yield* audit.record({
						action: "request_denied",
						keyId: check.keyId,
						route,
						reason: check.reason,
					});
				}

				if (!KeyCheck.$is("Valid")(check)) {
					return yield* new HttpApiError.Unauthorized({});
				}

				const { keyId, scopes, expiresAt } = check.holder;

				const required = Context.getOption(
					endpoint.annotations,
					RequiredScopes,
				);

				const requiredAny = Context.getOption(
					endpoint.annotations,
					RequiredAnyScopes,
				);

				if (Option.isNone(required) && Option.isNone(requiredAny)) {
					yield* audit.record({
						action: "request_denied",
						keyId,
						route,
						reason: "no_required_scopes",
					});

					return yield* new HttpApiError.Forbidden({});
				}

				const missingAll = Option.isSome(required)
					? missingScopes(scopes, required.value)
					: [];

				const missingAny =
					Option.isSome(requiredAny) &&
					!requiredAny.value.some((scope) => scopes.includes(scope));

				if (missingAll.length > 0 || missingAny) {
					yield* audit.record({
						action: "request_denied",
						keyId,
						route,
						reason: "missing_scope",
					});

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
