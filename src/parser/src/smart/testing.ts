import { ConfigProvider, Layer, type Schema } from "effect";
import { FetchHttpClient } from "effect/http";
import { SmartClient } from "./SmartClient.ts";

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

export const DEPARTMENTS = {
	items: [{ id: 17, nameUa: "Кафедра прикладу" }],
	total: 1,
};

export interface FakeOptions {
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
	/** The status of Microsoft's first answer to the sign-in, if not the form. */
	readonly authorizeFailsOnce?: number;
}

const stalled = () => new Response(new ReadableStream({ start: () => {} }));

/** A fake smart.ukma: its Spring sign-in redirects through Microsoft and
 *  hands the web app a token pair; the API needs the access token. */
export const makeFakeFetch = (options: FakeOptions = {}) => {
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
			const first =
				count(visits, `GET ${url.host}${url.pathname}`) === 1 &&
				options.authorizeFailsOnce !== undefined;

			return first
				? new Response("unavailable", { status: options.authorizeFailsOnce })
				: new Response(microsoftPage({}));
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

export const clientWith = (fake: ReturnType<typeof makeFakeFetch>) =>
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

export const count = (visits: ReadonlyArray<string>, visit: string) =>
	visits.filter((seen) => seen === visit).length;
