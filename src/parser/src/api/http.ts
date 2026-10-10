import { createServer } from "node:http";
import { NodeHttpServer } from "@effect/platform-node";
import { Config, Effect, Layer } from "effect";
import { HttpMiddleware, HttpRouter } from "effect/http";
import { HttpApiBuilder } from "effect/http-api";
import { Api } from "./Api.ts";

export const SystemApiHandlers = HttpApiBuilder.group(
	Api,
	"system",
	(handlers) =>
		handlers.handle("health", () =>
			HttpMiddleware.withLoggerDisabled(Effect.void),
		),
);

export const ApiRoutes = HttpApiBuilder.layer(Api).pipe(
	Layer.provide(SystemApiHandlers),
);

export const HttpServerLive = HttpRouter.serve(ApiRoutes).pipe(
	Layer.provide(
		NodeHttpServer.layerConfig(createServer, {
			port: Config.Port("PORT").pipe(Config.withDefault(8080)),
		}),
	),
);
