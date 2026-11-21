import {
	Cause,
	Config,
	Duration,
	Effect,
	Exit,
	Layer,
	Option,
	Predicate,
	Tracer,
} from "effect";
import {
	FetchHttpClient,
	HttpClient,
	HttpClientError,
	HttpClientResponse,
	HttpMiddleware,
} from "effect/http";
import { HttpApi } from "effect/http-api";
import {
	OtlpExporter,
	OtlpSerialization,
	OtlpTracer,
} from "effect/observability";
import { Api } from "../api/Api.ts";

/** Keeps the query and fragment out of a URL attribute: the smart.ukma
 *  sign-in redirect and the Microsoft callbacks carry tokens and codes there. */
const withoutQuery = (value: string): string => {
	const end = value.search(/[?#]/);

	return end === -1 ? value : value.slice(0, end);
};

/** The scheme and host of a URL: a server path can hold ids or an email
 *  (`GET unmatched` keeps the raw path out of the span name, not out of
 *  `url.full`). The span name carries the route. */
const originOf = (value: string): string => {
	const origin = URL.parse(value)?.origin;

	return origin === undefined || origin === "null" ? "" : origin;
};

/** Attributes a span never exports: the URL query and path, and what the
 *  server's request log adds to its span as an event, the raw `http.url` and
 *  the pretty-printed cause, which can quote it (`RouteNotFound (GET /…)`).
 *  The log line itself still has both. */
const DROPPED = new Set(["url.query", "url.path", "http.url", "effect.cause"]);

/** Attribute entries without the dropped keys, and `url.full` cut to its
 *  origin. */
const safeEntries = (
	entries: ReadonlyArray<readonly [string, unknown]>,
): ReadonlyArray<readonly [string, unknown]> =>
	entries.flatMap(([key, value]) =>
		DROPPED.has(key)
			? []
			: [
					[
						key,
						key === "url.full" && Predicate.isString(value)
							? originOf(value)
							: value,
					] as const,
				],
	);

/** Text with the query and fragment cut from every URL in it. */
const withoutUrlQueries = (text: string): string =>
	text.replace(/(https?:\/\/[^\s?#"'`]*)[?#][^\s"'`]*/g, "$1");

/** The failure a span reports, with URL queries cut from its messages and
 *  stacks: the exporter turns it into `exception.*` and the status message
 *  without passing through `event`. The caller's own failure is untouched. */
const redactedExit = (
	exit: Exit.Exit<unknown, unknown>,
): Exit.Exit<unknown, unknown> => {
	if (Exit.isSuccess(exit) || Cause.hasInterruptsOnly(exit.cause)) return exit;

	const errors = Cause.prettyErrors(exit.cause, { includeCauseInStack: true });

	if (errors.length === 0) return exit;

	return Exit.failCause(
		errors
			.map((error) => {
				const redacted = new Error(withoutUrlQueries(error.message));

				redacted.name = error.name;
				redacted.stack = withoutUrlQueries(error.stack ?? "");

				return Cause.die(redacted);
			})
			.reduce((all, cause) => Cause.combine(all, cause)),
	);
};

/** A span whose URL attributes never carry a query string. It delegates
 *  rather than inherits, so the exporter's span sees every write. */
const redactingSpan = (span: Tracer.Span): Tracer.Span => ({
	get _tag() {
		return span._tag;
	},
	get name() {
		return span.name;
	},
	get spanId() {
		return span.spanId;
	},
	get traceId() {
		return span.traceId;
	},
	get parent() {
		return span.parent;
	},
	get annotations() {
		return span.annotations;
	},
	get status() {
		return span.status;
	},
	get attributes() {
		return span.attributes;
	},
	get links() {
		return span.links;
	},
	get sampled() {
		return span.sampled;
	},
	get kind() {
		return span.kind;
	},
	end: (endTime, exit) => span.end(endTime, redactedExit(exit)),
	attribute: (key, value) => {
		for (const [safeKey, safeValue] of safeEntries([[key, value]])) {
			span.attribute(safeKey, safeValue);
		}
	},
	event: (name, startTime, attributes) =>
		span.event(
			name,
			startTime,
			attributes === undefined
				? undefined
				: Object.fromEntries(safeEntries(Object.entries(attributes))),
		),
	addLinks: (links) => span.addLinks(links),
});

/** `inner`, with the query and fragment stripped from every URL attribute of
 *  client and server spans alike. */
export const redactingTracer = (inner: Tracer.Tracer): Tracer.Tracer =>
	Tracer.make({
		span: (options) => redactingSpan(inner.span(options)),
		context: inner.context,
	});

const routeTemplates = (() => {
	const routes: Array<{
		readonly method: string;
		readonly template: string;
		readonly pattern: RegExp;
	}> = [];

	HttpApi.reflect(Api, {
		onGroup: () => undefined,
		onEndpoint: ({ endpoint }) => {
			const parts = endpoint.path
				.split("/")
				.map((part) =>
					part.startsWith(":")
						? "[^/]+"
						: part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
				);

			routes.push({
				method: endpoint.method,
				template: endpoint.path,
				pattern: new RegExp(`^${parts.join("/")}$`),
			});
		},
	});

	return routes;
})();

/** The server span name: the method and route template, such as
 *  `GET /v1/courses/:id`, never the raw path with its ids. */
export const serverSpanName = (method: string, url: string): string => {
	const path = withoutQuery(url);

	const route = routeTemplates.find(
		(candidate) => candidate.method === method && candidate.pattern.test(path),
	);

	return `${method} ${route?.template ?? "unmatched"}`;
};

export const ServerSpanNames = Layer.succeed(HttpMiddleware.SpanNameGenerator)(
	(request) => serverSpanName(request.method, request.url),
);

/** Gives up on an export after this long, reading the reply included; the
 *  exporter's capped, spaced retry then takes over. */
const EXPORT_TIMEOUT = Duration.seconds(10);

/** The fetch client with a deadline over the whole exchange. The exporter
 *  reads the reply body after the request returns, so the body is read here,
 *  inside the deadline, and handed on buffered. */
export const ExportHttpClient = Layer.effect(HttpClient.HttpClient)(
	Effect.gen(function* () {
		const client = yield* HttpClient.HttpClient;

		return client.pipe(
			HttpClient.transform((response, request) =>
				response.pipe(
					Effect.flatMap((reply) =>
						Effect.map(reply.arrayBuffer, (body) =>
							HttpClientResponse.fromWeb(
								request,
								new Response(body.byteLength === 0 ? null : body, {
									status: reply.status,
									headers: reply.headers,
								}),
							),
						),
					),
					Effect.timeoutOrElse({
						duration: EXPORT_TIMEOUT,
						orElse: () =>
							Effect.fail(
								new HttpClientError.HttpClientError({
									reason: new HttpClientError.TransportError({
										request,
										description: "OTLP export timed out",
									}),
								}),
							),
					}),
				),
			),
		);
	}),
).pipe(Layer.provide(FetchHttpClient.layer));

/** The OTLP tracer for one process, exporting to `url` through the
 *  `HttpClient` it is given. */
export const otlpTracer = (
	serviceName: "parser-api" | "parser-worker",
	url: string,
) =>
	OtlpTracer.make({ url, resource: { serviceName } }).pipe(
		Effect.map(redactingTracer),
		Layer.effect(Tracer.Tracer),
		Layer.provideMerge(OtlpExporter.layerFlusher),
		Layer.provide(OtlpSerialization.layerJson),
	);

/** Exports spans over OTLP/HTTP JSON when `OTEL_EXPORTER_OTLP_ENDPOINT` is
 *  set; without it, local runs and tests, nothing leaves the process. Only
 *  traces: the collector turns them into metrics. */
export const TelemetryLive = (serviceName: "parser-api" | "parser-worker") =>
	Layer.unwrap(
		Effect.gen(function* () {
			const endpoint = yield* Config.option(
				Config.URL("OTEL_EXPORTER_OTLP_ENDPOINT"),
			);

			if (Option.isNone(endpoint)) return Layer.empty;

			const url = new URL(
				"v1/traces",
				endpoint.value.href.replace(/\/?$/, "/"),
			);

			return otlpTracer(serviceName, url.href).pipe(
				Layer.provide(ExportHttpClient),
			);
		}),
	);
