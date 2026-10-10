import { NodeHttpServer } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { HttpClient, HttpRouter } from "effect/http";
import { ApiRoutes } from "./http.ts";

const TestServer = HttpRouter.serve(ApiRoutes, {
	disableLogger: true,
	disableListenLog: true,
}).pipe(Layer.provideMerge(NodeHttpServer.layerTest));

layer(TestServer)("GET /health", (it) => {
	it.effect("returns 200 without a key", () =>
		Effect.gen(function* () {
			const response = yield* HttpClient.get("/health");

			assert.strictEqual(response.status, 200);
		}),
	);
});
