import { assert, describe, it } from "@effect/vitest";
import { Effect, Fiber, Tracer } from "effect";
import { TestClock } from "effect/testing";
import {
	SmartClient,
	SmartNotJson,
	SmartRequestFailed,
	SmartSignInFailed,
} from "./SmartClient.ts";
import { clientWith, count, DEPARTMENTS, makeFakeFetch } from "./testing.ts";

const LIST = "/api/department";

const PASSWORD = "POST login.microsoftonline.com/common/login";

describe("SmartClient", () => {
	it.effect("signs in once and reads the API with the token", () => {
		const fake = makeFakeFetch();

		return Effect.gen(function* () {
			const smart = yield* SmartClient;

			assert.deepStrictEqual(yield* smart.get("/api/department"), DEPARTMENTS);
			assert.deepStrictEqual(yield* smart.get("/api/department"), DEPARTMENTS);
			assert.strictEqual(count(fake.visits, PASSWORD), 1);
		}).pipe(Effect.provide(clientWith(fake)));
	});

	it.effect("keeps the tokens out of every request and span", () => {
		const fake = makeFakeFetch();
		const spans: Array<Tracer.NativeSpan> = [];

		const tracer = Tracer.make({
			span: (options) => {
				const span = new Tracer.NativeSpan(options);
				spans.push(span);

				return span;
			},
		});

		return Effect.gen(function* () {
			const smart = yield* SmartClient;

			yield* smart.get("/api/department");

			const attributes = JSON.stringify(
				spans.map((span) => [...span.attributes]),
			);

			assert.isAbove(spans.length, 0);
			assert.notInclude(attributes, "refresh-1");
			assert.notInclude(attributes, "access-1");
			assert.notInclude(attributes, "code-1");
			assert.strictEqual(
				count(fake.visits, "GET smart.ukma.edu.ua/get-user"),
				0,
			);
		}).pipe(Effect.provide(clientWith(fake)), Effect.withTracer(tracer));
	});

	for (const status of [401, 403]) {
		it.effect(`signs in again when a held token gets a ${status}`, () => {
			const rejected = new Map<string, number>();
			const fake = makeFakeFetch({ rejected });

			return Effect.gen(function* () {
				const smart = yield* SmartClient;

				yield* smart.get(LIST);
				rejected.set("access-1", status);

				assert.deepStrictEqual(yield* smart.get(LIST), DEPARTMENTS);
				assert.strictEqual(count(fake.visits, PASSWORD), 2);
			}).pipe(Effect.provide(clientWith(fake)));
		});
	}

	it.effect("reports a 403 right after a sign-in as the API's refusal", () => {
		const fake = makeFakeFetch({ apiStatus: 403 });

		return Effect.gen(function* () {
			const smart = yield* SmartClient;

			const error = yield* Effect.flip(smart.get(LIST));

			assert.instanceOf(error, SmartRequestFailed);
			assert.strictEqual(error.status, 403);
			assert.strictEqual(count(fake.visits, PASSWORD), 1);
		}).pipe(Effect.provide(clientWith(fake)));
	});

	it.effect("fails the sign-in when a fresh one is still turned down", () => {
		const fake = makeFakeFetch({ apiStatus: 401 });

		return Effect.gen(function* () {
			const smart = yield* SmartClient;

			const error = yield* Effect.flip(smart.get("/api/department"));

			assert.instanceOf(error, SmartSignInFailed);
			assert.strictEqual(
				error.reason,
				"still signed out of /api/department after a fresh sign-in",
			);
			assert.strictEqual(count(fake.visits, PASSWORD), 1);
		}).pipe(Effect.provide(clientWith(fake)));
	});

	it.effect("does not post the password again after a broken callback", () => {
		const fake = makeFakeFetch({ callbackDown: true });

		return Effect.gen(function* () {
			const smart = yield* SmartClient;

			const error = yield* Effect.flip(smart.get("/api/department"));

			assert.instanceOf(error, SmartSignInFailed);
			assert.strictEqual(count(fake.visits, PASSWORD), 1);
		}).pipe(Effect.provide(clientWith(fake)));
	});

	it.effect("does not post the password again after a stalled callback", () => {
		const fake = makeFakeFetch({ callbackStalls: true });

		return Effect.gen(function* () {
			const smart = yield* SmartClient;
			const fiber = yield* Effect.forkChild(Effect.flip(smart.get(LIST)));

			yield* TestClock.adjust("2 minutes");
			const error = yield* Fiber.join(fiber);

			assert.instanceOf(error, SmartSignInFailed);
			assert.strictEqual(count(fake.visits, PASSWORD), 1);
		}).pipe(Effect.provide(clientWith(fake)));
	});

	it.effect(
		"gives up on a stalled response after the time limit and retries it",
		() => {
			const fake = makeFakeFetch({ stallsOnce: LIST });
			const asked = () => count(fake.visits, `GET smart.ukma.edu.ua${LIST}`);

			return Effect.gen(function* () {
				const smart = yield* SmartClient;
				const fiber = yield* Effect.forkChild(smart.get(LIST));

				yield* TestClock.adjust("29 seconds");
				assert.strictEqual(asked(), 1);

				yield* TestClock.adjust("3 seconds");
				assert.deepStrictEqual(yield* Fiber.join(fiber), DEPARTMENTS);
				assert.strictEqual(asked(), 2);
			}).pipe(Effect.provide(clientWith(fake)));
		},
	);

	it.effect("retries a 503 from Microsoft before the password", () => {
		const fake = makeFakeFetch({ authorizeFailsOnce: 503 });

		return Effect.gen(function* () {
			const smart = yield* SmartClient;
			const fiber = yield* Effect.forkChild(smart.get(LIST));

			yield* TestClock.adjust("3 seconds");
			assert.deepStrictEqual(yield* Fiber.join(fiber), DEPARTMENTS);
			assert.strictEqual(count(fake.visits, PASSWORD), 1);
		}).pipe(Effect.provide(clientWith(fake)));
	});

	it.effect("fails a sign-in that stops on another host", () =>
		Effect.gen(function* () {
			const smart = yield* SmartClient;

			const error = yield* Effect.flip(smart.get("/api/department"));

			assert.instanceOf(error, SmartSignInFailed);
			assert.strictEqual(error.reason, "stopped on mfa.example.com");
		}).pipe(
			Effect.provide(
				clientWith(makeFakeFetch({ detour: "https://mfa.example.com/setup" })),
			),
		),
	);

	it.effect("fails a reply that is not JSON", () =>
		Effect.gen(function* () {
			const smart = yield* SmartClient;

			const error = yield* Effect.flip(smart.get("/api/unknown"));

			assert.instanceOf(error, SmartNotJson);
		}).pipe(Effect.provide(clientWith(makeFakeFetch()))),
	);
});
