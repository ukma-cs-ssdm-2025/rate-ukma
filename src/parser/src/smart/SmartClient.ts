import {
	Clock,
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
	Semaphore,
} from "effect";
import {
	FetchHttpClient,
	HttpClientRequest,
	type HttpClientResponse,
} from "effect/http";
import {
	MicrosoftSessions,
	MicrosoftSignInFailed,
	SignedOut,
	withSignIn,
} from "../microsoft/session.ts";

/** The web app's own host: its API answers here, while the contract's
 *  smart-services host rejects the same token with a 403. */
export const SMART_URL = "https://smart.ukma.edu.ua";

const REFRESH_PATH = "/api/auth/refresh-token";

/** An access token this close to its expiry is refreshed before use. */
const EXPIRY_MARGIN = Duration.seconds(30);

export class SmartSignInFailed extends Schema.TaggedError<SmartSignInFailed>()(
	"SmartSignInFailed",
	{ reason: Schema.String },
) {
	override get message() {
		return this.reason;
	}
}

/** `status` 0 is a transport error. */
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

const isRefusal = (error: unknown): error is SignedOut | SmartRequestFailed =>
	error instanceof SignedOut ||
	(error instanceof SmartRequestFailed && error.status === 403);

/** The last redirect of a sign-in: Spring hands the web app the token pair
 *  in its query. It is read from the `Location` header and never requested,
 *  so no request URL, log line or span holds the tokens. */
const isTokenHop = (next: URL) =>
	next.origin === SMART_URL && next.pathname === "/get-user";

const isTransient = (error: SmartError): boolean =>
	error instanceof SmartRequestFailed &&
	(error.status === 0 || error.status === 429 || error.status >= 500);

/** The pair the sign-in hands the web app in the query of `/get-user`, and
 *  `PUT /api/auth/refresh-token` returns; each refresh replaces both. */
const Tokens = Schema.Struct({
	accessToken: Schema.RedactedFromValue(Schema.NonEmptyString),
	refreshToken: Schema.RedactedFromValue(Schema.NonEmptyString),
});

type Tokens = typeof Tokens.Type;

const decodeTokens = Schema.decodeUnknownOption(Tokens);

/** The access token is a JWT; its `exp` claim says when it expires. */
const JwtClaims = Schema.fromJsonString(Schema.Struct({ exp: Schema.Number }));

const decodeJwtClaims = Schema.decodeUnknownOption(JwtClaims);

const expiresAt = (tokens: Tokens): Option.Option<number> =>
	decodeJwtClaims(
		Buffer.from(
			Redacted.value(tokens.accessToken).split(".")[1] ?? "",
			"base64url",
		).toString(),
	).pipe(Option.map(({ exp }) => exp * 1000));

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

			const sessions = yield* MicrosoftSessions;
			const session = yield* sessions.open({ email, password }, gap);

			// Kept in memory only, never logged or stored.
			const held = yield* Ref.make(Option.none<Tokens>());

			const send = (
				request: HttpClientRequest.HttpClientRequest,
				path: string,
			) =>
				session
					.send(request)
					.pipe(
						Effect.catchTag("HttpClientError", () =>
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

				const tokens = yield* decodeTokens(
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

				yield* Ref.set(held, Option.some(tokens));
				yield* Effect.logInfo("Signed in to smart.ukma");

				return tokens;
			}).pipe(
				Effect.catchTag("HttpClientError", () =>
					Effect.fail(
						new SmartRequestFailed({ path: "/start-login", status: 0 }),
					),
				),
			);

			/** A turned-down refresh token is `SignedOut`, so the caller signs in;
			 *  a server or transport error keeps the pair for a retry. */
			const refresh = (tokens: Tokens) =>
				Effect.gen(function* () {
					const response = yield* send(
						HttpClientRequest.put(`${SMART_URL}${REFRESH_PATH}`).pipe(
							HttpClientRequest.bodyJsonUnsafe({
								refreshToken: Redacted.value(tokens.refreshToken),
							}),
						),
						REFRESH_PATH,
					);

					if ([400, 401, 403].includes(response.status)) {
						return yield* new SignedOut({ path: REFRESH_PATH });
					}

					if (response.status !== 200) {
						return yield* new SmartRequestFailed({
							path: REFRESH_PATH,
							status: response.status,
						});
					}

					const fresh = yield* response.json.pipe(
						Effect.map(decodeTokens),
						Effect.option,
						Effect.map(Option.flatten),
						Effect.flatMap(Effect.fromOption),
						Effect.mapError(
							() => new SmartRequestFailed({ path: REFRESH_PATH, status: 200 }),
						),
					);

					yield* Ref.set(held, Option.some(fresh));

					return fresh;
				});

			// Token reads and renewals take turns, so two requests never spend the
			// same rotating refresh token or sign in twice for one expiry.
			const lock = yield* Semaphore.make(1);

			const currentTokens = lock.withPermit(
				Effect.gen(function* () {
					const tokens = yield* Ref.get(held);

					if (Option.isNone(tokens)) return yield* signIn;

					const now = yield* Clock.currentTimeMillis;

					const expiring = expiresAt(tokens.value).pipe(
						Option.exists(
							(expiry) => expiry - Duration.toMillis(EXPIRY_MARGIN) <= now,
						),
					);

					return expiring ? yield* refresh(tokens.value) : tokens.value;
				}),
			);

			/** Refreshes `stale` unless another request already replaced it. */
			const renew = (stale: Tokens) =>
				lock.withPermit(
					Ref.get(held).pipe(
						Effect.flatMap((tokens) =>
							Option.isSome(tokens) && tokens.value !== stale
								? Effect.succeed(tokens.value)
								: refresh(stale),
						),
					),
				);

			const read = (
				response: HttpClientResponse.HttpClientResponse,
				path: string,
			) =>
				Effect.gen(function* () {
					if (response.status === 401) return yield* new SignedOut({ path });

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

			const fetchWith = (path: string, tokens: Tokens) =>
				send(
					HttpClientRequest.get(`${SMART_URL}${path}`).pipe(
						HttpClientRequest.bearerToken(tokens.accessToken),
					),
					path,
				).pipe(Effect.flatMap((response) => read(response, path)));

			const fetchJson = (path: string) =>
				currentTokens.pipe(Effect.flatMap((tokens) => fetchWith(path, tokens)));

			// The web app refreshes on a 403 too, so a 401 or 403 gets one refresh
			// before a 403 counts as a refusal and a 401 as signed out.
			const fetchRenewing = (path: string) =>
				currentTokens.pipe(
					Effect.flatMap((tokens) =>
						fetchWith(path, tokens).pipe(
							Effect.catchIf(isRefusal, () =>
								renew(tokens).pipe(
									Effect.flatMap((fresh) => fetchWith(path, fresh)),
								),
							),
						),
					),
				);

			const get = (path: string) =>
				withSignIn(
					fetchRenewing(path),
					lock.withPermit(signIn),
					fetchJson(path),
				).pipe(
					Effect.catchTag("MicrosoftSignInFailed", ({ reason }) =>
						Effect.fail(new SmartSignInFailed({ reason })),
					),
					Effect.retry({
						while: isTransient,
						schedule: Schedule.exponential("2 seconds").pipe(
							Schedule.upTo({ times: 3 }),
						),
					}),
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
