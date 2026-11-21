import { Config, Effect, Layer, Option, Predicate, Tracer } from "effect";
import { FetchHttpClient, HttpMiddleware } from "effect/http";
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

/** Attribute entries without `url.query`, and `url.full` without its query. */
const safeEntries = (
	entries: ReadonlyArray<readonly [string, unknown]>,
): ReadonlyArray<readonly [string, unknown]> =>
	entries.flatMap(([key, value]) =>
		key === "url.query"
			? []
			: [
					[
						key,
						key === "url.full" && Predicate.isString(value)
							? withoutQuery(value)
							: value,
					] as const,
				],
	);

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
	end: (endTime, exit) => span.end(endTime, exit),
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

			return OtlpTracer.make({
				url: url.href,
				resource: { serviceName },
			}).pipe(
				Effect.map(redactingTracer),
				Layer.effect(Tracer.Tracer),
				Layer.provideMerge(OtlpExporter.layerFlusher),
				Layer.provide(OtlpSerialization.layerJson),
				Layer.provide(FetchHttpClient.layer),
			);
		}),
	);
