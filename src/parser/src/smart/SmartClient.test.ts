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

/** A JWT-shaped token whose `exp` is in seconds of the test clock, which
 *  starts at 0. */
const tokenOf = (name: string, exp: number) =>
	`header.${Buffer.from(JSON.stringify({ sub: name, exp })).toString("base64url")}.signature`;

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
	/** `exp` of the access tokens the fake hands out. */
	readonly expiry: number;
	/** `exp` of the first one, if it differs. */
	readonly firstExpiry?: number;
	/** The API's status for every access token, instead of the data. */
	readonly apiStatus?: number;
	/** The status for these access tokens only. */
	readonly rejected?: ReadonlyMap<string, number>;
	/** The refresh endpoint's status instead of a new pair. */
	readonly refreshStatus?: number;
	/** Where Microsoft sends the account after the password, if not back. */
	readonly detour?: string;
	/** Whether the Spring callback drops the connection. */
	readonly callbackDown?: boolean;
}

/** A fake smart.ukma: its Spring sign-in redirects through Microsoft and
 *  hands the web app a token pair; the API needs the access token, and each
 *  refresh accepts only the latest refresh token and rotates it. */
const makeFakeFetch = (options: FakeOptions) => {
	const visits: Array<string> = [];
	const refreshTokens: Array<string> = [];
	let issued = 0;
	let latestRefresh = "";

	const issue = () => {
		issued += 1;
		latestRefresh = `refresh-${issued}`;

		return {
			accessToken: tokenOf(
				`access-${issued}`,
				issued === 1 ? (options.firstExpiry ?? options.expiry) : options.expiry,
			),
			refreshToken: latestRefresh,
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

			return redirect(`/get-user?${new URLSearchParams(issue())}`);
		}

		if (url.pathname === "/api/auth/refresh-token") {
			const { refreshToken } = JSON.parse(String(init?.body));
			refreshTokens.push(refreshToken);

			if (options.refreshStatus !== undefined) {
				return new Response(null, { status: options.refreshStatus });
			}

			return refreshToken === latestRefresh
				? json(issue())
				: new Response(null, { status: 401 });
		}

		const token = headers.get("authorization")?.replace("Bearer ", "") ?? "";
		const status = options.rejected?.get(token) ?? options.apiStatus;

		if (!token.startsWith("header."))
			return new Response(null, { status: 401 });

		if (status !== undefined) return new Response(null, { status });

		if (url.pathname === "/api/department") return json(DEPARTMENTS);

		return new Response("<html>app</html>");
	};

	return { fetch, visits, refreshTokens };
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

const PASSWORD = "POST login.microsoftonline.com/common/login";

const REFRESH = "PUT smart.ukma.edu.ua/api/auth/refresh-token";

describe("SmartClient", () => {
	it.effect("signs in once and reads the API with the token", () => {
		const fake = makeFakeFetch({ expiry: 3600 });

		return Effect.gen(function* () {
			const smart = yield* SmartClient;

			assert.deepStrictEqual(yield* smart.get("/api/department"), DEPARTMENTS);
			assert.deepStrictEqual(yield* smart.get("/api/department"), DEPARTMENTS);
			assert.strictEqual(count(fake.visits, PASSWORD), 1);
			assert.strictEqual(count(fake.visits, REFRESH), 0);
		}).pipe(Effect.provide(clientWith(fake)));
	});

	it.effect("keeps the tokens out of every request and span", () => {
		const fake = makeFakeFetch({ expiry: 3600 });
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
			assert.notInclude(attributes, tokenOf("access-1", 3600));
			assert.notInclude(attributes, "code-1");
			assert.strictEqual(
				count(fake.visits, "GET smart.ukma.edu.ua/get-user"),
				0,
			);
		}).pipe(Effect.provide(clientWith(fake)), Effect.withTracer(tracer));
	});

	it.effect(
		"refreshes a token about to expire with the latest refresh token",
		() => {
			const fake = makeFakeFetch({ expiry: 10 });

			return Effect.gen(function* () {
				const smart = yield* SmartClient;

				yield* smart.get("/api/department");
				yield* smart.get("/api/department");
				yield* smart.get("/api/department");

				assert.strictEqual(count(fake.visits, PASSWORD), 1);
				assert.deepStrictEqual(fake.refreshTokens, ["refresh-1", "refresh-2"]);
			}).pipe(Effect.provide(clientWith(fake)));
		},
	);

	it.effect(
		"never spends one refresh token twice for requests at the same time",
		() => {
			const fake = makeFakeFetch({ expiry: 10 });

			return Effect.gen(function* () {
				const smart = yield* SmartClient;

				yield* smart.get("/api/department");
				yield* Effect.all(
					[smart.get("/api/department"), smart.get("/api/department")],
					{ concurrency: 2 },
				);

				assert.strictEqual(count(fake.visits, PASSWORD), 1);
				assert.deepStrictEqual(fake.refreshTokens, ["refresh-1", "refresh-2"]);
			}).pipe(Effect.provide(clientWith(fake)));
		},
	);

	it.effect(
		"keeps the pair and retries when the refresh endpoint is down",
		() => {
			const fake = makeFakeFetch({ expiry: 10, refreshStatus: 503 });

			return Effect.gen(function* () {
				const smart = yield* SmartClient;

				yield* smart.get("/api/department");

				const fiber = yield* Effect.forkChild(
					Effect.flip(smart.get("/api/department")),
				);

				yield* TestClock.adjust("1 minute");

				const error = yield* Fiber.join(fiber);

				assert.instanceOf(error, SmartRequestFailed);
				assert.strictEqual(error.status, 503);
				assert.strictEqual(count(fake.visits, REFRESH), 4);
				assert.strictEqual(count(fake.visits, PASSWORD), 1);
			}).pipe(Effect.provide(clientWith(fake)));
		},
	);

	it.effect("signs in when the refresh token is turned down", () => {
		const fake = makeFakeFetch({
			expiry: 3600,
			firstExpiry: 10,
			refreshStatus: 401,
		});

		return Effect.gen(function* () {
			const smart = yield* SmartClient;

			yield* smart.get("/api/department");
			yield* smart.get("/api/department");

			assert.strictEqual(count(fake.visits, REFRESH), 1);
			assert.strictEqual(count(fake.visits, PASSWORD), 2);
		}).pipe(Effect.provide(clientWith(fake)));
	});

	it.effect("refreshes after a 401 before it signs in again", () => {
		const fake = makeFakeFetch({
			expiry: 3600,
			rejected: new Map([[tokenOf("access-1", 3600), 401]]),
		});

		return Effect.gen(function* () {
			const smart = yield* SmartClient;

			assert.deepStrictEqual(yield* smart.get("/api/department"), DEPARTMENTS);
			assert.strictEqual(count(fake.visits, REFRESH), 1);
			assert.strictEqual(count(fake.visits, PASSWORD), 1);
		}).pipe(Effect.provide(clientWith(fake)));
	});

	it.effect(
		"refreshes after a 403 and reports a second one as a refusal",
		() => {
			const fake = makeFakeFetch({ expiry: 3600, apiStatus: 403 });

			return Effect.gen(function* () {
				const smart = yield* SmartClient;

				const error = yield* Effect.flip(smart.get("/api/department"));

				assert.instanceOf(error, SmartRequestFailed);
				assert.strictEqual(error.status, 403);
				assert.strictEqual(count(fake.visits, REFRESH), 1);
				assert.strictEqual(count(fake.visits, PASSWORD), 1);
			}).pipe(Effect.provide(clientWith(fake)));
		},
	);

	it.effect("fails the sign-in when a fresh one is still turned down", () => {
		const fake = makeFakeFetch({ expiry: 3600, apiStatus: 401 });

		return Effect.gen(function* () {
			const smart = yield* SmartClient;

			const error = yield* Effect.flip(smart.get("/api/department"));

			assert.instanceOf(error, SmartSignInFailed);
			assert.strictEqual(
				error.reason,
				"still signed out of /api/department after a fresh sign-in",
			);
			assert.strictEqual(count(fake.visits, PASSWORD), 2);
		}).pipe(Effect.provide(clientWith(fake)));
	});

	it.effect("does not post the password again after a broken callback", () => {
		const fake = makeFakeFetch({ expiry: 3600, callbackDown: true });

		return Effect.gen(function* () {
			const smart = yield* SmartClient;

			const error = yield* Effect.flip(smart.get("/api/department"));

			assert.instanceOf(error, SmartSignInFailed);
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
				clientWith(
					makeFakeFetch({
						expiry: 3600,
						detour: "https://mfa.example.com/setup",
					}),
				),
			),
		),
	);

	it.effect("fails a reply that is not JSON", () =>
		Effect.gen(function* () {
			const smart = yield* SmartClient;

			const error = yield* Effect.flip(smart.get("/api/unknown"));

			assert.instanceOf(error, SmartNotJson);
		}).pipe(Effect.provide(clientWith(makeFakeFetch({ expiry: 3600 })))),
	);
});
