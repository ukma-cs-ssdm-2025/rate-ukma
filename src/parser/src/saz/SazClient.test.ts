import { assert, describe, it } from "@effect/vitest";
import { ConfigProvider, Effect, Layer } from "effect";
import { FetchHttpClient } from "effect/http";
import { SazClient, SazRequestFailed, SazSignInFailed } from "./SazClient.ts";

const MICROSOFT = "https://login.microsoftonline.com";

const microsoftPage = (config: Record<string, string>) =>
	`<html><script>$Config=${JSON.stringify({
		urlPost: "/common/login",
		sFT: "flow-1",
		sCtx: "ctx-1",
		canary: "canary-1",
		...config,
	})};</script></html>`;

const redirect = (location: string, cookie?: string) =>
	new Response(null, {
		status: 302,
		headers: cookie ? { location, "set-cookie": cookie } : { location },
	});

/** A fake САЗ and Microsoft sign-in: a САЗ page needs the session cookie,
 *  which only the right password leads to. */
const makeFakeFetch = () => {
	const visits: Array<string> = [];

	const fetch = async (input: string | URL | Request, init?: RequestInit) => {
		const url = new URL(input instanceof Request ? input.url : input);
		const cookie = new Headers(init?.headers).get("cookie") ?? "";
		visits.push(`${init?.method ?? "GET"} ${url.host}${url.pathname}`);

		if (
			url.origin === MICROSOFT &&
			url.pathname === "/common/oauth2/authorize"
		) {
			return new Response(microsoftPage({}), {
				headers: { "set-cookie": "esctx=e-1; path=/" },
			});
		}

		if (url.origin === MICROSOFT && url.pathname === "/common/login") {
			const form = new URLSearchParams(
				await new Request(url, { method: "POST", body: init?.body }).text(),
			);

			return cookie.includes("esctx=e-1") &&
				form.get("passwd") === "right-password" &&
				form.get("flowToken") === "flow-1"
				? redirect("https://my.ukma.edu.ua/auth/o365?code=code-1")
				: new Response(microsoftPage({ sErrorCode: "50126" }));
		}

		if (url.pathname === "/auth/o365") {
			return url.searchParams.get("code") === "code-1"
				? new Response("<html>signed in</html>", {
						headers: { "set-cookie": "PHPSESSID=session-1; path=/" },
					})
				: redirect(`${MICROSOFT}/common/oauth2/authorize?client_id=saz`);
		}

		if (!cookie.includes("PHPSESSID=session-1")) return redirect("/auth/o365");

		return url.pathname === "/course/100001"
			? new Response("<html>course 100001</html>")
			: new Response("not found", { status: 404 });
	};

	return { fetch, visits };
};

const clientWith = (password: string, fake: ReturnType<typeof makeFakeFetch>) =>
	SazClient.layer.pipe(
		Layer.provide(Layer.succeed(FetchHttpClient.Fetch, fake.fetch)),
		Layer.provide(
			ConfigProvider.layer(
				ConfigProvider.fromEnvRecord({
					CORPORATE_EMAIL: "test.user@ukma.edu.ua",
					CORPORATE_PASSWORD: password,
					SAZ_REQUEST_GAP: "0 millis",
				}),
			),
		),
	);

describe("SazClient", () => {
	it.effect("signs in once and reuses the session", () => {
		const fake = makeFakeFetch();

		return Effect.gen(function* () {
			const saz = yield* SazClient;

			assert.strictEqual(
				yield* saz.get("/course/100001"),
				"<html>course 100001</html>",
			);
			assert.strictEqual(
				yield* saz.get("/course/100001"),
				"<html>course 100001</html>",
			);

			assert.strictEqual(
				fake.visits.filter(
					(visit) => visit === "POST login.microsoftonline.com/common/login",
				).length,
				1,
			);
		}).pipe(Effect.provide(clientWith("right-password", fake)));
	});

	it.effect("fails the sign-in with Microsoft's error code", () =>
		Effect.gen(function* () {
			const saz = yield* SazClient;

			const error = yield* Effect.flip(saz.get("/course/100001"));

			assert.instanceOf(error, SazSignInFailed);
			assert.strictEqual(error.reason, "Microsoft error 50126");
		}).pipe(Effect.provide(clientWith("wrong-password", makeFakeFetch()))),
	);

	it.effect("reports a missing page with its status", () =>
		Effect.gen(function* () {
			const saz = yield* SazClient;

			const error = yield* Effect.flip(saz.get("/course/100002"));

			assert.instanceOf(error, SazRequestFailed);
			assert.strictEqual(error.status, 404);
		}).pipe(Effect.provide(clientWith("right-password", makeFakeFetch()))),
	);
});
