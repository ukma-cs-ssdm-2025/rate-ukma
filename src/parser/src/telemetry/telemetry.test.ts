import { assert, describe, it, layer } from "@effect/vitest";
import { Effect, Layer, Predicate, Redacted, Tracer } from "effect";
import { NodeHttpServer } from "@effect/platform-node";
import { HttpClient, HttpClientRequest, HttpRouter } from "effect/http";
import { ApiRoutes, AuthLive } from "../api/http.ts";
import { ChangeLog } from "../changes/ChangeLog.ts";
import { TestDatabase, testDatabaseUrl } from "../db/testing.ts";
import { Keys } from "../keys/Keys.ts";
import { SmartClient } from "../smart/SmartClient.ts";
import { clientWith, makeFakeFetch } from "../smart/testing.ts";
import {
	redactingTracer,
	ServerSpanNames,
	serverSpanName,
} from "./telemetry.ts";

/** Every span a run starts, behind the same redaction as the OTLP export. */
const recorder = () => {
	const spans: Array<Tracer.NativeSpan> = [];

	const tracer = redactingTracer(
		Tracer.make({
			span: (options) => {
				const span = new Tracer.NativeSpan(options);

				spans.push(span);

				return span;
			},
		}),
	);

	return { spans, tracer };
};

/** Attributes and event attributes that hold a token, an email or a URL
 *  with its query. */
const leaksIn = (spans: ReadonlyArray<Tracer.NativeSpan>) =>
	spans.flatMap((span) =>
		[
			...span.attributes,
			...span.events.flatMap(([, , attributes]) => Object.entries(attributes)),
		].flatMap((entry) => {
			const text = JSON.stringify(entry, (_, item) =>
				Predicate.isBigInt(item) ? String(item) : item,
			);

			return /accessToken|refreshToken|@/.test(text) ||
				/https?:\/\/[^\s"]*\?/.test(text)
				? [text]
				: [];
		}),
	);

describe("serverSpanName", () => {
	it("names a span by its route template, never the raw path", () => {
		assert.strictEqual(
			serverSpanName("POST", "/v1/courses/crs_0193/merge?x=1"),
			"POST /v1/courses/:id/merge",
		);
		assert.strictEqual(
			serverSpanName("GET", "/v1/offerings?after=10"),
			"GET /v1/offerings",
		);
		assert.strictEqual(
			serverSpanName("GET", "/v1/students/someone"),
			"GET unmatched",
		);
	});
});

describe("smart.ukma crawl step", () => {
	it.effect("leaves no token, email or query in a span", () => {
		const { spans, tracer } = recorder();

		return Effect.gen(function* () {
			const smart = yield* SmartClient;

			yield* smart.get("/api/department?page=1&size=50");

			const names = spans.map(({ name }) => name);

			assert.include(names, "MicrosoftSession.signIn");
			assert.include(names, "GET");
			assert.deepStrictEqual(leaksIn(spans), []);
			assert.deepInclude(
				spans.map((span) => span.attributes.get("url.full")),
				"https://smart.ukma.edu.ua/api/department",
			);
		}).pipe(
			Effect.provide(clientWith(makeFakeFetch())),
			Effect.withTracer(tracer),
		);
	});
});

const api = recorder();

const ApiLive = Layer.empty.pipe(
	Layer.provide(HttpRouter.serve(ApiRoutes)),
	Layer.provide(ServerSpanNames),
	Layer.provideMerge(NodeHttpServer.layerTest),
	Layer.provideMerge(AuthLive),
	Layer.provideMerge(ChangeLog.layer),
	Layer.provideMerge(TestDatabase(testDatabaseUrl)),
	Layer.provideMerge(Layer.succeed(Tracer.Tracer)(api.tracer)),
);

layer(ApiLive, { timeout: 30_000, excludeTestServices: true })(
	"API call",
	(it) => {
		it.effect("names server spans by route and leaves no query in a span", () =>
			Effect.gen(function* () {
				// The migrations' spans hold DDL, such as the `<@` operator.
				api.spans.length = 0;

				const keys = yield* Keys;
				const http = yield* HttpClient.HttpClient;

				const key = yield* keys.create({
					name: "telemetry test",
					scopes: ["catalog:read", "review:decide"],
					expiresInDays: 1,
					createdBy: null,
				});

				const authorized = HttpClientRequest.bearerToken(
					Redacted.value(key.token),
				);

				yield* http.execute(
					authorized(HttpClientRequest.get("/v1/offerings?after=0&limit=5")),
				);
				yield* http.execute(
					authorized(HttpClientRequest.post("/v1/courses/crs_missing/unmerge")),
				);

				const server = api.spans.filter(({ kind }) => kind === "server");

				assert.deepStrictEqual(
					server.map(({ name }) => name),
					["GET /v1/offerings", "POST /v1/courses/:id/unmerge"],
				);
				assert.include(
					api.spans.map(({ name }) => name),
					"ApiKeyAuth.check",
				);
				assert.deepStrictEqual(leaksIn(api.spans), []);
			}),
		);
	},
);
