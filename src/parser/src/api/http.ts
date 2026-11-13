import { createServer } from "node:http";
import { NodeHttpServer } from "@effect/platform-node";
import { Config, Effect, Layer } from "effect";
import { HttpMiddleware, HttpRouter } from "effect/http";
import { HttpApiBuilder } from "effect/http-api";
import { Audit } from "../audit/Audit.ts";
import { Keys } from "../keys/Keys.ts";
import { Api, Caller } from "./Api.ts";
import { ApiKeyAuthLive } from "./auth.ts";

export const SystemApiHandlers = HttpApiBuilder.group(
	Api,
	"system",
	(handlers) =>
		handlers.handle("health", () =>
			HttpMiddleware.withLoggerDisabled(Effect.void),
		),
);

export const KeyApiHandlers = HttpApiBuilder.group(Api, "key", (handlers) =>
	handlers.handle("current", () =>
		Effect.gen(function* () {
			const caller = yield* Caller;

			return {
				id: caller.keyId,
				scopes: caller.scopes,
				expiresAt: caller.expiresAt.toISOString(),
			};
		}),
	),
);

/** Needs a `SqlClient`: keys and the audit log live in the database. */
export const AuthLive = ApiKeyAuthLive.pipe(
	Layer.provideMerge(Keys.layer),
	Layer.provideMerge(Audit.layer),
);

const ApiRoutes = HttpApiBuilder.layer(Api).pipe(
	Layer.provide([SystemApiHandlers, KeyApiHandlers]),
	Layer.provide(AuthLive),
);

export const HttpServerLive = HttpRouter.serve(ApiRoutes).pipe(
	Layer.provide(
		NodeHttpServer.layerConfig(createServer, {
			port: Config.Port("PORT").pipe(Config.withDefault(8080)),
		}),
	),
);
