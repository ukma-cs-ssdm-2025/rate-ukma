import {
	Context,
	type Duration,
	Effect,
	Layer,
	Redacted,
	Ref,
	Schema,
	Semaphore,
} from "effect";
import {
	Cookies,
	HttpClient,
	HttpClientRequest,
	type HttpClientError,
	type HttpClientResponse,
} from "effect/http";

const MICROSOFT_URL = "https://login.microsoftonline.com";

const MAX_REDIRECTS = 10;

export class MicrosoftSignInFailed extends Schema.TaggedError<MicrosoftSignInFailed>()(
	"MicrosoftSignInFailed",
	{ reason: Schema.String },
) {
	override get message() {
		return this.reason;
	}
}

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

export interface Account {
	readonly email: string;
	readonly password: Redacted.Redacted<string>;
}

export interface Session {
	/** Sends one request at a time with a gap after each, carries each host's
	 *  cookies and follows redirects. */
	send(
		request: HttpClientRequest.HttpClientRequest,
	): Effect.Effect<
		HttpClientResponse.HttpClientResponse,
		HttpClientError.HttpClientError
	>;
	/** Drops every cookie, opens `start`, which redirects to Microsoft, and
	 *  posts the account to its password form. Returns the response the
	 *  redirects back to the app end on. */
	signIn(
		start: string,
	): Effect.Effect<
		HttpClientResponse.HttpClientResponse,
		MicrosoftSignInFailed | HttpClientError.HttpClientError
	>;
}

/** Opens a browser-like session for an app that signs in through Microsoft. */
const open = Effect.fnUntraced(function* (
	http: HttpClient.HttpClient,
	account: Account,
	gap: Duration.Duration,
) {
	// Node fetch drops Set-Cookie on redirects it follows, and the sign-in sets
	// cookies on both hosts mid-chain, so redirects are walked here.
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
					.pipe(Effect.ensuring(Effect.sleep(gap))),
			);

			yield* Ref.update(jar, (hosts) =>
				new Map(hosts).set(host, Cookies.merge(held, response.cookies)),
			);

			return response;
		});

	const send = (request: HttpClientRequest.HttpClientRequest) =>
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
		});

	const readForm = (response: HttpClientResponse.HttpClientResponse) =>
		response.text.pipe(
			Effect.flatMap((body) =>
				decodeMicrosoftForm(MICROSOFT_CONFIG.exec(body)?.[1]),
			),
			Effect.mapError(
				() =>
					new MicrosoftSignInFailed({
						reason: "the Microsoft form did not parse",
					}),
			),
		);

	const signIn = (start: string) =>
		Effect.gen(function* () {
			yield* Ref.set(jar, new Map());

			const first = yield* send(HttpClientRequest.get(start));
			const form = yield* readForm(first);
			const target = new URL(form.urlPost, first.request.url);

			if (target.origin !== MICROSOFT_URL) {
				return yield* new MicrosoftSignInFailed({
					reason: `the sign-in form posts to ${target.host}`,
				});
			}

			const response = yield* send(
				HttpClientRequest.post(target).pipe(
					HttpClientRequest.bodyUrlParams({
						login: account.email,
						loginfmt: account.email,
						passwd: Redacted.value(account.password),
						ctx: form.sCtx,
						flowToken: form.sFT,
						canary: form.canary,
						type: "11",
						LoginOptions: "3",
					}),
				),
			);

			const end = new URL(response.request.url).origin;

			if (end === MICROSOFT_URL) {
				const next = yield* readForm(response);

				return yield* new MicrosoftSignInFailed({
					reason:
						next.sErrorCode === undefined
							? `stopped on the Microsoft page ${next.pgid ?? "unknown"}`
							: `Microsoft error ${next.sErrorCode}`,
				});
			}

			// Another host, such as an MFA setup page, is a failed sign-in too;
			// taken as a success, every later page would post the password again.
			if (end !== new URL(start).origin) {
				return yield* new MicrosoftSignInFailed({
					reason: `stopped on ${new URL(end).host}`,
				});
			}

			return response;
		});

	return { send, signIn } satisfies Session;
});

export class MicrosoftSessions extends Context.Service<
	MicrosoftSessions,
	{
		/** A session of its own: cookies and the request gap are not shared. */
		open(account: Account, gap: Duration.Duration): Effect.Effect<Session>;
	}
>()("ukma-data/microsoft/MicrosoftSessions") {
	static readonly layer = Layer.effect(
		MicrosoftSessions,
		Effect.gen(function* () {
			const http = yield* HttpClient.HttpClient;

			return MicrosoftSessions.of({
				open: (account, gap) => open(http, account, gap),
			});
		}),
	);
}
