import { assert, describe, it } from "@effect/vitest";
import {
	ConfigProvider,
	Effect,
	Fiber,
	Layer,
	type Schema,
	Tracer,
} from "effect";
import { FetchHttpClient } from "effect/http";
import { TestClock } from "effect/testing";
import {
	SmartClient,
	SmartNotJson,
	SmartRequestFailed,
	SmartSignInFailed,
} from "./SmartClient.ts";

const MICROSOFT = "https://login.microsoftonline.com";

const microsoftPage = (config: Record<string, string>) =>
	`<html><script>$Config=${JSON.stringify({
		urlPost: "/common/login",
		sFT: "flow-1",
		sCtx: "ctx-1",
		canary: "canary-1",
		...config,
	})};</script></html>`;

const redirect = (location: string) =>
	new Response(null, { status: 302, headers: { location } });

const json = (body: Schema.Json) =>
	new Response(JSON.stringify(body), {
		headers: { "content-type": "application/json" },
	});

const DEPARTMENTS = {
	items: [{ id: 17, nameUa: "Кафедра прикладу" }],
	total: 1,
};

interface FakeOptions {
	/** The API's status for every access token, instead of the data. */
	readonly apiStatus?: number;
	/** The status for these access tokens only. */
	readonly rejected?: ReadonlyMap<string, number>;
	/** Where Microsoft sends the account after the password, if not back. */
	readonly detour?: string;
	/** Whether the Spring callback drops the connection. */
	readonly callbackDown?: boolean;
	/** Whether the Spring callback never finishes its answer. */
	readonly callbackStalls?: boolean;
	/** A path whose first answer never finishes. */
	readonly stallsOnce?: string;
}

const stalled = () => new Response(new ReadableStream({ start: () => {} }));

/** A fake smart.ukma: its Spring sign-in redirects through Microsoft and
 *  hands the web app a token pair; the API needs the access token. */
const makeFakeFetch = (options: FakeOptions = {}) => {
	const visits: Array<string> = [];
	let issued = 0;

	const issue = () => {
		issued += 1;

		return {
			accessToken: `access-${issued}`,
			refreshToken: `refresh-${issued}`,
		};
	};

	const fetch = async (input: string | URL | Request, init?: RequestInit) => {
		const url = new URL(input instanceof Request ? input.url : input);
		const headers = new Headers(init?.headers);
		visits.push(`${init?.method ?? "GET"} ${url.host}${url.pathname}`);

		if (url.pathname === "/start-login") {
			return redirect(`${MICROSOFT}/common/oauth2/authorize?client_id=smart`);
		}

		if (url.origin === MICROSOFT && url.pathname.endsWith("/authorize")) {
			return new Response(microsoftPage({}));
		}

		if (url.origin === MICROSOFT && url.pathname === "/common/login") {
			return redirect(
				options.detour ??
					"https://smart.ukma.edu.ua/login/oauth2/code/azure?code=code-1",
			);
		}

		if (url.pathname === "/login/oauth2/code/azure") {
			if (options.callbackDown) throw new TypeError("fetch failed");

			if (options.callbackStalls) return stalled();

			return redirect(`/get-user?${new URLSearchParams(issue())}`);
		}

		const token = headers.get("authorization")?.replace("Bearer ", "") ?? "";
		const status = options.rejected?.get(token) ?? options.apiStatus;

		if (!token.startsWith("access-"))
			return new Response(null, { status: 401 });

		if (status !== undefined) return new Response(null, { status });

		if (
			url.pathname === options.stallsOnce &&
			count(visits, `GET ${url.host}${url.pathname}`) === 1
		) {
			return stalled();
		}

		if (url.pathname === "/api/department") return json(DEPARTMENTS);

		return new Response("<html>app</html>");
	};

	return { fetch, visits };
};

const clientWith = (fake: ReturnType<typeof makeFakeFetch>) =>
	SmartClient.layer.pipe(
		Layer.provide(Layer.succeed(FetchHttpClient.Fetch, fake.fetch)),
		Layer.provide(
			ConfigProvider.layer(
				ConfigProvider.fromEnvRecord({
					CORPORATE_EMAIL: "test.user@example.com",
					CORPORATE_PASSWORD: "right-password",
					SMART_REQUEST_GAP: "0 millis",
				}),
			),
		),
	);

const count = (visits: ReadonlyArray<string>, visit: string) =>
	visits.filter((seen) => seen === visit).length;

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
