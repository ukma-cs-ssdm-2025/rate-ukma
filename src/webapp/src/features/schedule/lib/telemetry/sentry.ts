/**
 * The only file in the app that imports @sentry/*. Everything else goes
 * through `Telemetry`, so this file is the entire vendor surface.
 *
 * The browser SDK installs its own `error` and `unhandledrejection`
 * listeners (globalHandlersIntegration, on by default), so we add none.
 * Replay and Feedback are opt-in integrations and stay unlisted. Product
 * events never come here; they go to `/api/schedule/events` (see `events.ts`).
 */

import * as Sentry from "@sentry/react";
import type { ErrorContext, ErrorReporter } from "./types";

export const create = (dsn: string): ErrorReporter => ({
	init: () => {
		Sentry.init({
			dsn,
			sendDefaultPii: false,
			// Errors only: no performance budget for a two-screen SPA.
			tracesSampleRate: 0,
			release: import.meta.env.VITE_APP_VERSION,
			environment: import.meta.env.MODE,
		});
	},
	captureError: (cause: unknown, context?: ErrorContext) => {
		Sentry.captureException(
			cause,
			context ? { extra: { ...context } } : undefined,
		);
	},
	setUser: (id: string | null) => {
		Sentry.setUser(id === null ? null : { id });
	},
});
