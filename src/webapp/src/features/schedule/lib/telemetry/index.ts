import { browserSink, type EventSink } from "./events";
import { noop } from "./noop";
import type {
	ErrorContext,
	ErrorReporter,
	EventProps,
	Telemetry,
	TelemetryEvent,
	TelemetryMeasure,
} from "./types";

export type {
	CalendarTarget,
	ErrorContext,
	EventProps,
	Telemetry,
	TelemetryEvent,
	TelemetryMeasure,
} from "./types";
export { opaqueId } from "./user";

const dsn = import.meta.env.VITE_SENTRY_DSN ?? "";

let reporter: ErrorReporter = noop;
let sink: EventSink | null | undefined;

/** Created on first use, so a module import alone touches no browser API. */
const events = (): EventSink | null => {
	sink ??= browserSink();
	return sink;
};

/**
 * Errors go to Sentry, and only when a DSN is baked in: without one the
 * vendor chunk is never fetched, so an unconfigured build ships no Sentry
 * code at all. Errors raised before the import resolves are dropped rather
 * than queued. Product events always go to our own `/api/schedule/events`.
 */
export const telemetry: Telemetry = {
	init: () => {
		if (dsn === "") return;
		void import("./sentry").then((module) => {
			reporter = module.create(dsn);
			reporter.init();
		});
	},
	captureError: (cause: unknown, context?: ErrorContext) =>
		reporter.captureError(cause, context),
	track: (event: TelemetryEvent, props?: EventProps) =>
		events()?.push(props ? { name: event, props } : { name: event }),
	measure: (name: TelemetryMeasure, value: number, props?: EventProps) =>
		events()?.push({ name, props: { ...props, value } }),
	// The server reads the user from the cookie at send time, so queued events
	// leave before a sign-out clears it.
	setUser: (id: string | null) => {
		events()?.flush();
		reporter.setUser(id);
	},
};
