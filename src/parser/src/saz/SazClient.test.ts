import { assert, describe, it } from "@effect/vitest";
import { ConfigProvider, Effect, Fiber, Layer } from "effect";
import { FetchHttpClient } from "effect/http";
import { TestClock } from "effect/testing";
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

interface FakeOptions {
	/** How САЗ answers the sign-in callback. */
	readonly callback?: "session" | "no session" | "error";
	/** САЗ answers for a path, by how many times it was asked before. */
	readonly pages?: Record<string, (asked: number) => Response>;
}

/** A fake САЗ and Microsoft sign-in: a САЗ page needs the session cookie,
 *  which only the right password leads to. */
const makeFakeFetch = ({
	callback = "session",
	pages = {},
}: FakeOptions = {}) => {
	const visits: Array<string> = [];
	/** How many times each fake page was served to a signed-in request. */
	const served = new Map<string, number>();

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
			if (url.searchParams.get("code") !== "code-1") {
				return redirect(`${MICROSOFT}/common/oauth2/authorize?client_id=saz`);
			}

			if (callback === "error") return new Response("error", { status: 500 });

			return new Response("<html>signed in</html>", {
				headers:
					callback === "session"
						? { "set-cookie": "PHPSESSID=session-1; path=/" }
						: {},
			});
		}

		if (!cookie.includes("PHPSESSID=session-1")) return redirect("/auth/o365");

		const page = pages[url.pathname];

		if (page) {
			const before = served.get(url.pathname) ?? 0;
			served.set(url.pathname, before + 1);

			return page(before);
		}

		return url.pathname === "/course/100001"
			? new Response("<html>course 100001</html>")
			: new Response("not found", { status: 404 });
	};

	return { fetch, visits, served };
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

	const passwordPosts = (fake: ReturnType<typeof makeFakeFetch>) =>
		fake.visits.filter(
			(visit) => visit === "POST login.microsoftonline.com/common/login",
		).length;

	it.effect("fails the sign-in once when САЗ keeps no session after it", () => {
		const fake = makeFakeFetch({ callback: "no session" });

		return Effect.gen(function* () {
			const saz = yield* SazClient;

			const error = yield* Effect.flip(saz.get("/course/100001"));

			assert.instanceOf(error, SazSignInFailed);
			assert.strictEqual(
				error.reason,
				"signed out of /course/100001 right after a fresh sign-in",
			);
			assert.strictEqual(passwordPosts(fake), 1);
		}).pipe(Effect.provide(clientWith("right-password", fake)));
	});

	it.effect("fails the sign-in when the САЗ callback answers an error", () => {
		const fake = makeFakeFetch({ callback: "error" });

		return Effect.gen(function* () {
			const saz = yield* SazClient;

			const error = yield* Effect.flip(saz.get("/course/100001"));

			assert.instanceOf(error, SazSignInFailed);
			assert.strictEqual(error.reason, "the САЗ sign-in answered 500");
			assert.strictEqual(passwordPosts(fake), 1);
		}).pipe(Effect.provide(clientWith("right-password", fake)));
	});

	const asked = (fake: ReturnType<typeof makeFakeFetch>, path: string) =>
		fake.served.get(path) ?? 0;

	it.effect("retries a САЗ 500 once", () => {
		const fake = makeFakeFetch({
			pages: { "/course/100005": () => new Response("error", { status: 500 }) },
		});

		return Effect.gen(function* () {
			const saz = yield* SazClient;

			const fiber = yield* Effect.forkChild(
				Effect.flip(saz.get("/course/100005")),
			);

			yield* TestClock.adjust("1 minute");
			const error = yield* Fiber.join(fiber);

			assert.instanceOf(error, SazRequestFailed);
			assert.strictEqual(error.status, 500);
			assert.strictEqual(asked(fake, "/course/100005"), 2);
		}).pipe(Effect.provide(clientWith("right-password", fake)));
	});

	it.effect("waits as long as a 429 asks before trying again", () => {
		const fake = makeFakeFetch({
			pages: {
				"/course/100006": (before) =>
					before === 0
						? new Response("slow down", {
								status: 429,
								headers: { "retry-after": "60" },
							})
						: new Response("<html>course 100006</html>"),
			},
		});

		return Effect.gen(function* () {
			const saz = yield* SazClient;

			const fiber = yield* Effect.forkChild(saz.get("/course/100006"));

			yield* TestClock.adjust("59 seconds");
			assert.strictEqual(asked(fake, "/course/100006"), 1);

			yield* TestClock.adjust("1 second");
			assert.strictEqual(
				yield* Fiber.join(fiber),
				"<html>course 100006</html>",
			);
		}).pipe(Effect.provide(clientWith("right-password", fake)));
	});

	it.effect(
		"fails a 429 at once when it asks for a wait over two minutes",
		() => {
			const fake = makeFakeFetch({
				pages: {
					"/course/100008": () =>
						new Response("slow down", {
							status: 429,
							headers: { "retry-after": "121" },
						}),
				},
			});

			return Effect.gen(function* () {
				const saz = yield* SazClient;

				const error = yield* Effect.flip(saz.get("/course/100008"));

				assert.instanceOf(error, SazRequestFailed);
				assert.strictEqual(error.status, 429);
				assert.strictEqual(asked(fake, "/course/100008"), 1);
			}).pipe(Effect.provide(clientWith("right-password", fake)));
		},
	);

	it.effect(
		"gives up on a stalled response after the time limit and retries it",
		() => {
			const fake = makeFakeFetch({
				pages: {
					"/course/100007": (before) =>
						before === 0
							? new Response(new ReadableStream({ start: () => {} }))
							: new Response("<html>course 100007</html>"),
				},
			});

			return Effect.gen(function* () {
				const saz = yield* SazClient;
				const fiber = yield* Effect.forkChild(saz.get("/course/100007"));

				yield* TestClock.adjust("29 seconds");
				assert.strictEqual(asked(fake, "/course/100007"), 1);

				yield* TestClock.adjust("3 seconds");
				assert.strictEqual(
					yield* Fiber.join(fiber),
					"<html>course 100007</html>",
				);
				assert.strictEqual(asked(fake, "/course/100007"), 2);
			}).pipe(Effect.provide(clientWith("right-password", fake)));
		},
	);
});
