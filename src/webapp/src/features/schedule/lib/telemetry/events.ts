/**
 * Product events go to our own `/api/schedule/events`, never to a vendor. They queue
 * in memory and leave as one small batch when the batch is full, a few
 * seconds after the first one, or when the page is hidden or closed.
 * `sendBeacon` is the one request a browser still delivers after `pagehide`.
 */

import type {
	TelemetryEvent,
	TelemetryMeasure,
} from "@/features/schedule/core";
import type { EventProps } from "./types";

export interface QueuedEvent {
	readonly name: TelemetryEvent | TelemetryMeasure;
	readonly props?: EventProps;
}

/** The server takes at most this many events per request. */
export const MAX_BATCH = 20;
const FLUSH_DELAY_MS = 5_000;

export interface EventSink {
	push(event: QueuedEvent): void;
	flush(): void;
}

export interface Timers<Handle> {
	readonly set: (run: () => void, ms: number) => Handle;
	readonly clear: (handle: Handle) => void;
}

export const createEventSink = <Handle>(
	send: (body: string) => void,
	timers: Timers<Handle>,
): EventSink => {
	const queue: Array<QueuedEvent> = [];
	let timer: Handle | undefined;
	const flush = () => {
		if (timer !== undefined) timers.clear(timer);
		timer = undefined;
		while (queue.length > 0) {
			send(JSON.stringify({ events: queue.splice(0, MAX_BATCH) }));
		}
	};
	return {
		push: (event) => {
			queue.push(event);
			if (queue.length >= MAX_BATCH) flush();
			else timer ??= timers.set(flush, FLUSH_DELAY_MS);
		},
		flush,
	};
};

const ENDPOINT = "/api/schedule/events";

const beacon = (body: string): void => {
	const blob = new Blob([body], { type: "application/json" });
	if (navigator.sendBeacon(ENDPOINT, blob)) return;
	void fetch(ENDPOINT, { method: "POST", body: blob, keepalive: true }).catch(
		() => {},
	);
};

/** The browser sink, or none outside a browser and in automated ones (e2e,
 *  the production smoke run), which would only count themselves. */
export const browserSink = (): EventSink | null => {
	// Node (the unit tests) has a navigator, but no beacon and no document.
	const browser: Navigator | undefined = globalThis.navigator;
	if (browser === undefined || !("sendBeacon" in browser) || browser.webdriver)
		return null;
	const sink = createEventSink(beacon, {
		set: (run, ms) => setTimeout(run, ms),
		clear: (handle) => clearTimeout(handle),
	});
	addEventListener("pagehide", sink.flush);
	document.addEventListener("visibilitychange", () => {
		if (document.visibilityState === "hidden") sink.flush();
	});
	return sink;
};
