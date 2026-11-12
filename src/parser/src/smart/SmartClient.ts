import {
	Config,
	Context,
	Duration,
	Effect,
	Layer,
	Option,
	Redacted,
	Ref,
	Schedule,
	Schema,
} from "effect";
import { FetchHttpClient, HttpClientRequest } from "effect/http";
import {
	MicrosoftSessions,
	MicrosoftSignInFailed,
	SignedOut,
	withSignIn,
} from "../microsoft/session.ts";

/** The web app's own host: its API answers here, while the contract's
 *  smart-services host rejects the same token with a 403. */
export const SMART_URL = "https://smart.ukma.edu.ua";

export class SmartSignInFailed extends Schema.TaggedError<SmartSignInFailed>()(
	"SmartSignInFailed",
	{ reason: Schema.String },
) {
	override get message() {
		return this.reason;
	}
}

/** `status` 0 is a transport error or a request that ran out of time. */
export class SmartRequestFailed extends Schema.TaggedError<SmartRequestFailed>()(
	"SmartRequestFailed",
	{ path: Schema.String, status: Schema.Number },
) {}

/** A 200 whose body is not JSON, such as the web app's page for an unknown path. */
export class SmartNotJson extends Schema.TaggedError<SmartNotJson>()(
	"SmartNotJson",
	{ path: Schema.String },
) {}

export type SmartError = SmartSignInFailed | SmartRequestFailed | SmartNotJson;

/** The last redirect of a sign-in: Spring hands the web app the token pair
 *  in its query. It is read from the `Location` header and never requested,
 *  so no request URL, log line or span holds the tokens. */
const isTokenHop = (next: URL) =>
	next.origin === SMART_URL && next.pathname === "/get-user";

const isRequestFailed = Schema.is(SmartRequestFailed);

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

/** The query of `/get-user` holds a refresh token too. It is not kept: the
 *  access token lives 5 minutes, longer than a crawl of four lists, and an
 *  expired one is replaced by a new sign-in. */
const SignedIn = Schema.Struct({
	accessToken: Schema.RedactedFromValue(Schema.NonEmptyString),
});

const decodeSignedIn = Schema.decodeUnknownOption(SignedIn);

export class SmartClient extends Context.Service<
	SmartClient,
	{
		/** The JSON body of a GET to the smart.ukma API, signing in first when
		 *  no token is held. */
		get(path: string): Effect.Effect<Schema.Json, SmartError>;
	}
>()("ukma-data/smart/SmartClient") {
	static readonly layerNoDeps = Layer.effect(
		SmartClient,
		Effect.gen(function* () {
			const email = yield* Config.NonEmptyString("CORPORATE_EMAIL");

			const password = yield* Config.schema(
				Schema.Redacted(Schema.NonEmptyString),
				"CORPORATE_PASSWORD",
			);

			const gap = yield* Config.Duration("SMART_REQUEST_GAP").pipe(
				Config.withDefault(Duration.seconds(1)),
			);

			const timeout = yield* Config.Duration("SMART_REQUEST_TIMEOUT").pipe(
				Config.withDefault(Duration.seconds(30)),
			);

			const sessions = yield* MicrosoftSessions;

			const session = yield* sessions.open(
				{ email, password },
				{ gap, timeout },
			);

			// Kept in memory only, never logged or stored.
			const held = yield* Ref.make(Option.none<Redacted.Redacted<string>>());

			const send = (
				request: HttpClientRequest.HttpClientRequest,
				path: string,
			) =>
				session
					.send(request)
					.pipe(
						Effect.catchTag(["HttpClientError", "TimeoutError"], () =>
							Effect.fail(new SmartRequestFailed({ path, status: 0 })),
						),
					);

			const signIn = Effect.gen(function* () {
				const landing = yield* session.signIn(
					`${SMART_URL}/start-login`,
					isTokenHop,
				);

				if (!isTokenHop(landing)) {
					return yield* new MicrosoftSignInFailed({
						reason: `the sign-in ended on ${landing.host}${landing.pathname}`,
					});
				}

				const { accessToken } = yield* decodeSignedIn(
					Object.fromEntries(landing.searchParams),
				).pipe(
					Effect.fromOption,
					Effect.mapError(
						() =>
							new MicrosoftSignInFailed({
								reason: "the sign-in gave no tokens",
							}),
					),
				);

				yield* Ref.set(held, Option.some(accessToken));
				yield* Effect.logInfo("Signed in to smart.ukma");
			}).pipe(
				Effect.catchTag(["HttpClientError", "TimeoutError"], () =>
					Effect.fail(
						new SmartRequestFailed({ path: "/start-login", status: 0 }),
					),
				),
			);

			// The web app treats a 403 as an expired token too, so a held token that
			// gets one counts as signed out. A `fresh` token cannot have expired, so
			// its 403 is the API refusing the list.
			const fetchJson = (path: string, fresh = false) =>
				Effect.gen(function* () {
					const token = yield* Ref.get(held);

					if (Option.isNone(token)) return yield* new SignedOut({ path });

					const response = yield* send(
						HttpClientRequest.get(`${SMART_URL}${path}`).pipe(
							HttpClientRequest.bearerToken(token.value),
						),
						path,
					);

					if (response.status === 401 || (response.status === 403 && !fresh)) {
						return yield* new SignedOut({ path });
					}

					if (response.status !== 200) {
						return yield* new SmartRequestFailed({
							path,
							status: response.status,
						});
					}

					return yield* response.json.pipe(
						Effect.mapError(() => new SmartNotJson({ path })),
					);
				});

			const get = (path: string) =>
				withSignIn(
					retryTransient(fetchJson(path)),
					retryTransient(signIn),
					retryTransient(fetchJson(path, true)),
				).pipe(
					Effect.catchTag("MicrosoftSignInFailed", ({ reason }) =>
						Effect.fail(new SmartSignInFailed({ reason })),
					),
				);

			return SmartClient.of({ get });
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
