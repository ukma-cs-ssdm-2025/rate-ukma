import {
	Config,
	Context,
	Duration,
	Effect,
	Layer,
	Redacted,
	Ref,
	Schema,
	Semaphore,
} from "effect";
import {
	Cookies,
	FetchHttpClient,
	HttpClient,
	HttpClientRequest,
	type HttpClientResponse,
} from "effect/http";

export const SAZ_URL = "https://my.ukma.edu.ua";

const MICROSOFT_URL = "https://login.microsoftonline.com";

const MAX_REDIRECTS = 10;

export class SazSignInFailed extends Schema.TaggedError<SazSignInFailed>()(
	"SazSignInFailed",
	{ reason: Schema.String },
) {
	override get message() {
		return this.reason;
	}
}

/** `status` 0 is a transport error or a request that ran out of time. */
export class SazRequestFailed extends Schema.TaggedError<SazRequestFailed>()(
	"SazRequestFailed",
	{
		path: Schema.String,
		status: Schema.Number,
		retryAfterSeconds: Schema.optional(Schema.Number),
	},
) {}

/** САЗ asked for a wait over `MAX_RETRY_AFTER_SECONDS`. The limit likely
 *  covers every page, so the crawl stops instead of going on to the next. */
export class SazRateLimited extends Schema.TaggedError<SazRateLimited>()(
	"SazRateLimited",
	{ path: Schema.String, retryAfterSeconds: Schema.Number },
) {}

export class SazSignedOut extends Schema.TaggedError<SazSignedOut>()(
	"SazSignedOut",
	{ path: Schema.String },
) {}

export type SazError = SazSignInFailed | SazRequestFailed | SazRateLimited;

/** The fields of Microsoft's `$Config` the password form needs. */
const MicrosoftForm = Schema.fromJsonString(
	Schema.Struct({
		urlPost: Schema.String,
		sFT: Schema.String,
		sCtx: Schema.String,
		canary: Schema.String,
		pgid: Schema.optional(Schema.String),
		sErrorCode: Schema.optional(Schema.String),
	}),
);

const decodeMicrosoftForm = Schema.decodeUnknownEffect(MicrosoftForm);

const MICROSOFT_CONFIG = /\$Config=(\{.*?\});/su;

const MAX_RETRIES = 3;

/** The longest `Retry-After` the client waits out. The crawl fetches one page
 *  at a time, so a longer wait would stall every page behind it. */
const MAX_RETRY_AFTER_SECONDS = 120;

/** The wait before trying a failed request again, or `undefined` to give up.
 *  A САЗ 500 repeats for the same page, so a 5xx gets one retry only. */
const retryDelay = (
	error: SazError,
	retries: number,
): Duration.Duration | undefined => {
	if (!(error instanceof SazRequestFailed)) return undefined;

	const backoff = Duration.seconds(2 * 2 ** retries);

	if (error.status === 429 && retries < MAX_RETRIES) {
		return error.retryAfterSeconds === undefined
			? backoff
			: Duration.seconds(error.retryAfterSeconds);
	}

	if (error.status === 0 && retries < MAX_RETRIES) return backoff;

	if (error.status >= 500 && retries < 1) return backoff;

	return undefined;
};

const RETRY_AFTER_SECONDS = /^\d+$/u;

const isOnMicrosoft = (response: HttpClientResponse.HttpClientResponse) =>
	new URL(response.request.url).host !== new URL(SAZ_URL).host;

/** A signed-out request ends on Microsoft, or on `/auth/` when the redirect
 *  chain stops early. A sign-in itself ends on `/auth/o365` with a 200. */
const isSignInPage = (response: HttpClientResponse.HttpClientResponse) =>
	isOnMicrosoft(response) ||
	new URL(response.request.url).pathname.startsWith("/auth/");

export class SazClient extends Context.Service<
	SazClient,
	{
		/** The body of a САЗ page, signing in first when the session is gone. */
		get(path: string): Effect.Effect<string, SazError>;
	}
>()("ukma-data/saz/SazClient") {
	static readonly layerNoDeps = Layer.effect(
		SazClient,
		Effect.gen(function* () {
			const email = yield* Config.NonEmptyString("CORPORATE_EMAIL");

			const password = yield* Config.schema(
				Schema.Redacted(Schema.NonEmptyString),
				"CORPORATE_PASSWORD",
			);

			const gap = yield* Config.Duration("SAZ_REQUEST_GAP").pipe(
				Config.withDefault(Duration.seconds(1)),
			);

			const timeLimit = yield* Config.Duration("SAZ_REQUEST_TIMEOUT").pipe(
				Config.withDefault(Duration.seconds(30)),
			);

			const http = yield* HttpClient.HttpClient;
			// Node fetch drops Set-Cookie on redirects it follows, and the sign-in
			// sets cookies on both hosts mid-chain, so redirects are walked here.
			const jar = yield* Ref.make(new Map<string, Cookies.Cookies>());
			const gate = yield* Semaphore.make(1);

			const execute = (request: HttpClientRequest.HttpClientRequest) =>
				Effect.gen(function* () {
					const host = new URL(request.url).host;
					const held = (yield* Ref.get(jar)).get(host) ?? Cookies.empty;

					const response = yield* gate.withPermit(
						http
							.execute(
								HttpClientRequest.setHeader(
									request,
									"cookie",
									Cookies.toCookieHeader(held),
								),
							)
							.pipe(
								// The body is read here, inside the time limit; later reads
								// get the cached bytes.
								Effect.tap((response) => response.arrayBuffer),
								Effect.timeout(timeLimit),
								Effect.ensuring(Effect.sleep(gap)),
							),
					);

					yield* Ref.update(jar, (hosts) =>
						new Map(hosts).set(host, Cookies.merge(held, response.cookies)),
					);

					return response;
				});

			const send = (
				request: HttpClientRequest.HttpClientRequest,
				path: string,
			): Effect.Effect<
				HttpClientResponse.HttpClientResponse,
				SazRequestFailed
			> =>
				Effect.gen(function* () {
					let response = yield* execute(request);

					for (let hop = 0; hop < MAX_REDIRECTS; hop++) {
						const location = response.headers.location;

						if (response.status < 300 || response.status >= 400 || !location) {
							return response;
						}

						response = yield* execute(
							HttpClientRequest.get(new URL(location, response.request.url)),
						);
					}

					return response;
				}).pipe(
					Effect.mapError(() => new SazRequestFailed({ path, status: 0 })),
				);

			const readForm = (response: HttpClientResponse.HttpClientResponse) =>
				response.text.pipe(
					Effect.flatMap((body) =>
						decodeMicrosoftForm(MICROSOFT_CONFIG.exec(body)?.[1]),
					),
					Effect.mapError(
						() =>
							new SazSignInFailed({
								reason: "the Microsoft form did not parse",
							}),
					),
				);

			const signIn = Effect.gen(function* () {
				yield* Ref.set(jar, new Map());

				const start = yield* send(
					HttpClientRequest.get(`${SAZ_URL}/auth/o365`),
					"/auth/o365",
				);

				const form = yield* readForm(start);
				const target = new URL(form.urlPost, start.request.url);

				if (target.origin !== MICROSOFT_URL) {
					return yield* new SazSignInFailed({
						reason: `the sign-in form posts to ${target.host}`,
					});
				}

				const response = yield* send(
					HttpClientRequest.post(target).pipe(
						HttpClientRequest.bodyUrlParams({
							login: email,
							loginfmt: email,
							passwd: Redacted.value(password),
							ctx: form.sCtx,
							flowToken: form.sFT,
							canary: form.canary,
							type: "11",
							LoginOptions: "3",
						}),
					),
					"/auth/o365",
				);

				if (isOnMicrosoft(response)) {
					const next = yield* readForm(response);

					return yield* new SazSignInFailed({
						reason:
							next.sErrorCode === undefined
								? `stopped on the Microsoft page ${next.pgid ?? "unknown"}`
								: `Microsoft error ${next.sErrorCode}`,
					});
				}

				// A callback that fails leaves no session, and signing in again for
				// each page would send the password thousands of times.
				if (response.status !== 200) {
					return yield* new SazSignInFailed({
						reason: `the САЗ sign-in answered ${response.status}`,
					});
				}

				yield* Effect.logInfo("Signed in to САЗ");
			});

			const fetchPage = (path: string) =>
				Effect.gen(function* () {
					const response = yield* send(
						HttpClientRequest.get(`${SAZ_URL}${path}`),
						path,
					);

					if (isSignInPage(response)) {
						return yield* new SazSignedOut({ path });
					}

					if (response.status !== 200) {
						const retryAfter = response.headers["retry-after"] ?? "";

						const retryAfterSeconds = RETRY_AFTER_SECONDS.test(retryAfter)
							? Number(retryAfter)
							: undefined;

						if (
							response.status === 429 &&
							retryAfterSeconds !== undefined &&
							retryAfterSeconds > MAX_RETRY_AFTER_SECONDS
						) {
							return yield* new SazRateLimited({ path, retryAfterSeconds });
						}

						return yield* new SazRequestFailed({
							path,
							status: response.status,
							retryAfterSeconds,
						});
					}

					return yield* response.text.pipe(
						Effect.mapError(() => new SazRequestFailed({ path, status: 0 })),
					);
				});

			const fetchSignedIn = (path: string) =>
				fetchPage(path).pipe(
					Effect.catchTag("SazSignedOut", () =>
						signIn.pipe(
							Effect.andThen(fetchPage(path)),
							Effect.catchTag("SazSignedOut", () =>
								Effect.fail(
									new SazSignInFailed({
										reason: `signed out of ${path} right after a fresh sign-in`,
									}),
								),
							),
						),
					),
				);

			const get = (path: string): Effect.Effect<string, SazError> => {
				const attempt = (retries: number): Effect.Effect<string, SazError> =>
					fetchSignedIn(path).pipe(
						Effect.catch((error) => {
							const delay = retryDelay(error, retries);

							return delay === undefined
								? Effect.fail(error)
								: Effect.sleep(delay).pipe(
										Effect.andThen(attempt(retries + 1)),
									);
						}),
					);

				return attempt(0);
			};

			return SazClient.of({ get });
		}),
	);

	static readonly layer = this.layerNoDeps.pipe(
		Layer.provide(FetchHttpClient.layer),
		Layer.provide(
			Layer.succeed(FetchHttpClient.RequestInit, { redirect: "manual" }),
		),
	);
}
