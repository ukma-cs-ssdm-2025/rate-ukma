import * as Sentry from "@sentry/react";

import { env } from "../../env";

export function initSentry() {
	if (!env.VITE_SENTRY_DSN_FRONTEND) {
		console.info("Sentry DSN not configured, skipping initialization");
		return;
	}

	Sentry.init({
		dsn: env.VITE_SENTRY_DSN_FRONTEND,

		enableLogs: true,

		tracesSampleRate: 0.2,

		replaysSessionSampleRate: 0.2,
		replaysOnErrorSampleRate: 1,

		sendDefaultPii: true,

		environment: env.VITE_ENVIRONMENT,

		integrations: [
			Sentry.browserTracingIntegration({
				enableInp: true,
			}),

			Sentry.replayIntegration({
				maskAllText: true,
				blockAllMedia: true,
			}),

			Sentry.consoleLoggingIntegration({
				levels: ["log", "warn", "error"],
			}),
		],
	});
}
