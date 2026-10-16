import { assert, describe, it } from "@effect/vitest";
import { ConfigProvider, Effect, Layer, type Schema } from "effect";
import { FetchHttpClient } from "effect/http";
import {
	SmartClient,
	SmartNotJson,
	SmartRequestFailed,
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

interface FakeOptions {
	/** `exp` of each signed-in access token. */
	readonly expiry: number;
	/** Access tokens the API answers with this status instead of the data. */
	readonly rejected?: ReadonlyMap<string, number>;
}

/** A fake smart.ukma: its Spring sign-in redirects through Microsoft and
 *  hands the web app a token pair; the API needs the access token. */
const makeFakeFetch = (options: FakeOptions) => {
	const visits: Array<string> = [];
	let signIns = 0;

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
				"https://smart.ukma.edu.ua/login/oauth2/code/azure?code=code-1",
			);
		}

		if (url.pathname === "/login/oauth2/code/azure") {
			signIns += 1;

			const query = new URLSearchParams({
				accessToken: tokenOf(`access-${signIns}`, options.expiry),
				refreshToken: `refresh-${signIns}`,
			});

			return redirect(`/get-user?${query}`);
		}

		if (url.pathname === "/get-user") return new Response("<html>app</html>");

		if (url.pathname === "/api/auth/refresh-token") {
			const body = JSON.parse(String(init?.body));

			return body.refreshToken === "refresh-1"
				? json({
						accessToken: tokenOf("access-refreshed", 3600),
						refreshToken: "refresh-2",
					})
				: new Response(null, { status: 401 });
		}

		const token = headers.get("authorization")?.replace("Bearer ", "") ?? "";
		const rejection = options.rejected?.get(token);

		if (!token.startsWith("header."))
			return new Response(null, { status: 401 });

		if (rejection !== undefined)
			return new Response(null, { status: rejection });

		if (url.pathname === "/api/department") {
			return json({
				items: [{ id: 17, nameUa: "Кафедра прикладу" }],
				total: 1,
			});
		}

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
					CORPORATE_EMAIL: "test.user@ukma.edu.ua",
					CORPORATE_PASSWORD: "right-password",
					SMART_REQUEST_GAP: "0 millis",
				}),
			),
		),
	);

const count = (visits: ReadonlyArray<string>, visit: string) =>
	visits.filter((seen) => seen === visit).length;

const SIGN_IN = "GET smart.ukma.edu.ua/login/oauth2/code/azure";

const REFRESH = "PUT smart.ukma.edu.ua/api/auth/refresh-token";

describe("SmartClient", () => {
	it.effect("signs in once and reads the API with the token", () => {
		const fake = makeFakeFetch({ expiry: 3600 });

		return Effect.gen(function* () {
			const smart = yield* SmartClient;

			const expected = {
				items: [{ id: 17, nameUa: "Кафедра прикладу" }],
				total: 1,
			};

			assert.deepStrictEqual(yield* smart.get("/api/department"), expected);
			assert.deepStrictEqual(yield* smart.get("/api/department"), expected);
			assert.strictEqual(count(fake.visits, SIGN_IN), 1);
			assert.strictEqual(count(fake.visits, REFRESH), 0);
		}).pipe(Effect.provide(clientWith(fake)));
	});

	it.effect("refreshes a token about to expire", () => {
		const fake = makeFakeFetch({ expiry: 10 });

		return Effect.gen(function* () {
			const smart = yield* SmartClient;

			yield* smart.get("/api/department");
			yield* smart.get("/api/department");

			assert.strictEqual(count(fake.visits, SIGN_IN), 1);
			assert.strictEqual(count(fake.visits, REFRESH), 1);
		}).pipe(Effect.provide(clientWith(fake)));
	});

	it.effect("signs in again after a 401", () => {
		const fake = makeFakeFetch({
			expiry: 3600,
			rejected: new Map([[tokenOf("access-1", 3600), 401]]),
		});

		return Effect.gen(function* () {
			const smart = yield* SmartClient;

			yield* smart.get("/api/department");

			assert.strictEqual(count(fake.visits, SIGN_IN), 2);
		}).pipe(Effect.provide(clientWith(fake)));
	});

	it.effect("reports a 403 without signing in again", () => {
		const fake = makeFakeFetch({
			expiry: 3600,
			rejected: new Map([[tokenOf("access-1", 3600), 403]]),
		});

		return Effect.gen(function* () {
			const smart = yield* SmartClient;

			const error = yield* Effect.flip(smart.get("/api/department"));

			assert.instanceOf(error, SmartRequestFailed);
			assert.strictEqual(error.status, 403);
			assert.strictEqual(count(fake.visits, SIGN_IN), 1);
		}).pipe(Effect.provide(clientWith(fake)));
	});

	it.effect("fails a reply that is not JSON", () =>
		Effect.gen(function* () {
			const smart = yield* SmartClient;

			const error = yield* Effect.flip(smart.get("/api/unknown"));

			assert.instanceOf(error, SmartNotJson);
		}).pipe(Effect.provide(clientWith(makeFakeFetch({ expiry: 3600 })))),
	);
});
