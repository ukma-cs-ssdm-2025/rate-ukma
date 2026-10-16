import {
	Config,
	Context,
	Duration,
	Effect,
	Layer,
	Schedule,
	Schema,
} from "effect";
import { constFalse } from "effect/Function";
import {
	FetchHttpClient,
	HttpClientRequest,
	type HttpClientResponse,
} from "effect/http";
import {
	MicrosoftSessions,
	SignedOut,
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

/** `status` 0 is a transport error. */
export class SazRequestFailed extends Schema.TaggedError<SazRequestFailed>()(
	"SazRequestFailed",
	{ path: Schema.String, status: Schema.Number },
) {}

export type SazError = SazSignInFailed | SazRequestFailed;

const isRequestFailed = Schema.is(SazRequestFailed);

const isTransient = (status: number) =>
	status === 0 || status === 429 || status >= 500;

/** Retries one step, never the sign-in-and-retry around it, so a failure
 *  after a sign-in that did not take cannot post the password again. */
const retryTransient = <A, E, R>(
	step: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> =>
	step.pipe(
		Effect.retry({
			while: (error) => isRequestFailed(error) && isTransient(error.status),
			schedule: Schedule.exponential("2 seconds").pipe(
				Schedule.upTo({ times: 3 }),
			),
		}),
	);

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

			const sessions = yield* MicrosoftSessions;
			const session = yield* sessions.open({ email, password }, gap);

			const send = (
				request: HttpClientRequest.HttpClientRequest,
				path: string,
			) =>
				session
					.send(request)
					.pipe(
						Effect.catchTag("HttpClientError", () =>
							Effect.fail(new SazRequestFailed({ path, status: 0 })),
						),
					);

			const signIn = session.signIn(`${SAZ_URL}/auth/o365`, constFalse).pipe(
				Effect.catchTag("HttpClientError", () =>
					Effect.fail(new SazRequestFailed({ path: "/auth/o365", status: 0 })),
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
						return yield* new SazRequestFailed({
							path,
							status: response.status,
						});
					}

					return yield* response.text.pipe(
						Effect.mapError(() => new SazRequestFailed({ path, status: 0 })),
					);
				});

			const get = (path: string) =>
				withSignIn(
					retryTransient(fetchPage(path)),
					retryTransient(signIn),
				).pipe(
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
