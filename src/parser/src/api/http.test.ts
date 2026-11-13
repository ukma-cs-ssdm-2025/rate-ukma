import { assert, layer } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { HttpServer } from "effect/http";
import { HttpApiTest } from "effect/http-api";
import { Api } from "./Api.ts";
import { SystemApiHandlers } from "./http.ts";

const makeClient = HttpApiTest.groups(Api, ["system"]);

layer(Layer.mergeAll(SystemApiHandlers, HttpServer.layerServices))(
	"GET /health",
	(it) => {
		it.effect("returns 200 without a key", () =>
			Effect.gen(function* () {
				const client = yield* makeClient;

				const response = yield* client.health({
					responseMode: "response-only",
				});

				assert.strictEqual(response.status, 200);
			}),
		);
	},
);
