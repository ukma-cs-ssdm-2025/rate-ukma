/**
 * The whole contract the app has with an analytics vendor. Nothing outside
 * `lib/telemetry` knows which backend is behind it: errors go to a vendor
 * (Sentry today), product events to our own `/api/schedule/events`.
 */

import type {
	TelemetryEvent,
	TelemetryMeasure,
} from "@/features/schedule/core";

/** Event and measure names live in core, so the server checks the same list
 *  the app sends. Adding one starts there. */
export type { TelemetryEvent, TelemetryMeasure };

/** Where the calendar went: a subscription in Google, Apple or Outlook, a
 *  download, or the feed link on the clipboard. */
export type CalendarTarget =
	| "google"
	| "apple"
	| "outlook"
	| "link"
	| "ics"
	| "png"
	| "text";

/** Strings attached to a captured error, shown next to the stack trace. */
export type ErrorContext = Readonly<Record<string, string>>;

/** Dimensions of one event; primitives only, never anything student-identifying. */
export type EventProps = Readonly<Record<string, string | number | boolean>>;

/** The vendor half: crashes and who they happened to. */
export interface ErrorReporter {
	init(): void;
	captureError(cause: unknown, context?: ErrorContext): void;
	setUser(id: string | null): void;
}

export interface Telemetry {
	/** Called once, before the first render. */
	init(): void;
	captureError(cause: unknown, context?: ErrorContext): void;
	track(event: TelemetryEvent, props?: EventProps): void;
	/** A number worth a distribution rather than a count: how many
	 *  disciplines a plan has, how many ІНП lines stayed unpublished. */
	measure(name: TelemetryMeasure, value: number, props?: EventProps): void;
	/** An opaque id, never the email; `null` clears it on sign-out. */
	setUser(id: string | null): void;
}
