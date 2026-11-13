import { Config, Context, Duration, Effect, Layer, Schema } from "effect";
import { constFalse } from "effect/Function";
import {
	FetchHttpClient,
	HttpClientRequest,
	type HttpClientResponse,
} from "effect/http";
import {
	MicrosoftSessions,
	SignedOut,
	statusOf,
	withSignIn,
} from "../microsoft/session.ts";

export const SAZ_URL = "https://my.ukma.edu.ua";

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

export type SazError = SazSignInFailed | SazRequestFailed | SazRateLimited;

const MAX_RETRIES = 3;

/** The longest `Retry-After` the client waits out. The crawl fetches one page
 *  at a time, so a longer wait would stall every page behind it. */
const MAX_RETRY_AFTER_SECONDS = 120;

/** The wait before trying a failed request again, or `undefined` to give up.
 *  A САЗ 500 repeats for the same page, so a 5xx gets one retry only. */
const retryDelay = (
	error: SazRequestFailed,
	retries: number,
): Duration.Duration | undefined => {
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

/** Retries one step, never the sign-in-and-retry around it, so a failure
 *  after a sign-in that did not take cannot post the password again. */
const retryStep = <A, E, R>(
	step: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> => {
	const attempt = (retries: number): Effect.Effect<A, E, R> =>
		step.pipe(
			Effect.catchIf(Schema.is(SazRequestFailed), (error) => {
				const delay = retryDelay(error, retries);

				return delay === undefined
					? Effect.fail(error)
					: Effect.sleep(delay).pipe(Effect.andThen(attempt(retries + 1)));
			}),
		);

	return attempt(0);
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

			const timeout = yield* Config.Duration("SAZ_REQUEST_TIMEOUT").pipe(
				Config.withDefault(Duration.seconds(30)),
			);

			const sessions = yield* MicrosoftSessions;

			const session = yield* sessions.open(
				{ email, password },
				{ gap, timeout },
			);

			const send = (
				request: HttpClientRequest.HttpClientRequest,
				path: string,
			) =>
				session
					.send(request)
					.pipe(
						Effect.catchTag(["HttpClientError", "TimeoutError"], () =>
							Effect.fail(new SazRequestFailed({ path, status: 0 })),
						),
					);

			const signIn = session.signIn(`${SAZ_URL}/auth/o365`, constFalse).pipe(
				Effect.catchTag(["HttpClientError", "TimeoutError"], (error) =>
					Effect.fail(
						new SazRequestFailed({
							path: "/auth/o365",
							status: statusOf(error),
						}),
					),
				),
				Effect.andThen(Effect.logInfo("Signed in to САЗ")),
			);

			const fetchPage = (path: string) =>
				Effect.gen(function* () {
					const response = yield* send(
						HttpClientRequest.get(`${SAZ_URL}${path}`),
						path,
					);

					if (isSignInPage(response)) {
						return yield* new SignedOut({ path });
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

			const get = (path: string) =>
				withSignIn(retryStep(fetchPage(path)), retryStep(signIn)).pipe(
					Effect.catchTag("MicrosoftSignInFailed", ({ reason }) =>
						Effect.fail(new SazSignInFailed({ reason })),
					),
				);

			return SazClient.of({ get });
		}),
	);

	static readonly layer = this.layerNoDeps.pipe(
		Layer.provide(MicrosoftSessions.layer),
		Layer.provide(FetchHttpClient.layer),
		Layer.provide(
			Layer.succeed(FetchHttpClient.RequestInit, { redirect: "manual" }),
		),
	);
}
