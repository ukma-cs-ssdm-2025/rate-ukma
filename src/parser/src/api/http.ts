import { createServer } from "node:http";
import { NodeHttpServer } from "@effect/platform-node";
import { Config, Effect, Layer } from "effect";
import { HttpMiddleware, HttpRouter } from "effect/http";
import { HttpApiBuilder } from "effect/http-api";
import { Audit } from "../audit/Audit.ts";
import { Keys } from "../keys/Keys.ts";
import { ListReader } from "../lists/ListReader.ts";
import type { PageOf } from "../lists/lists.ts";
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

/** Counts the page's rows for the request's audit row. */
const served = <A>(page: Effect.Effect<PageOf<A>>) =>
	page.pipe(
		Effect.tap(({ items }) =>
			Caller.use((caller) => caller.countRows(items.length)),
		),
	);

export const CatalogApiHandlers = HttpApiBuilder.group(
	Api,
	"catalog",
	(handlers) =>
		Effect.gen(function* () {
			const lists = yield* ListReader;

			return handlers
				.handle("terms", ({ query }) => served(lists.terms(query)))
				.handle("faculties", ({ query }) => served(lists.faculties(query)))
				.handle("departments", ({ query }) => served(lists.departments(query)))
				.handle("programmes", ({ query }) => served(lists.programmes(query)))
				.handle("offerings", ({ query }) => served(lists.offerings(query)));
		}),
);

export const ReviewApiHandlers = HttpApiBuilder.group(
	Api,
	"review",
	(handlers) =>
		Effect.gen(function* () {
			const lists = yield* ListReader;

			return handlers.handle("reviewCases", ({ query }) =>
				served(lists.reviewCases(query)),
			);
		}),
);

/** Needs a `SqlClient`: keys and the audit log live in the database. */
export const AuthLive = ApiKeyAuthLive.pipe(
	Layer.provideMerge(Keys.layer),
	Layer.provideMerge(Audit.layer),
);

export const ApiRoutes = HttpApiBuilder.layer(Api).pipe(
	Layer.provide([
		SystemApiHandlers,
		KeyApiHandlers,
		CatalogApiHandlers,
		ReviewApiHandlers,
	]),
	Layer.provide(ListReader.layer),
	Layer.provide(AuthLive),
);

export const HttpServerLive = HttpRouter.serve(ApiRoutes).pipe(
	Layer.provide(
		NodeHttpServer.layerConfig(createServer, {
			port: Config.Port("PORT").pipe(Config.withDefault(8080)),
		}),
	),
);
