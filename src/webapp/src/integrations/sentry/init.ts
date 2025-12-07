import * as Sentry from "@sentry/react";

import { env } from "../../env";

/**
 * Initialize Sentry for error tracking, logging, session replay, and performance monitoring.
 * Must be called as early as possible in the application lifecycle.
 */
export function initSentry() {
	// Skip initialization if DSN is not configured (e.g., in local development)
	if (!env.VITE_SENTRY_DSN_FRONTEND) {
		console.info("Sentry DSN not configured, skipping initialization");
		return;
	}

	Sentry.init({
		dsn: env.VITE_SENTRY_DSN_FRONTEND,

		// Enable logs to be sent to Sentry
		enableLogs: true,

		// Set sample rates based on environment
		tracesSampleRate: import.meta.env.MODE === "production" ? 0.1 : 1.0,

		// Capture 100% of sessions for replay in non-production
		replaysSessionSampleRate: import.meta.env.MODE === "production" ? 0.1 : 1.0,

		// Capture 100% of sessions with errors for replay
		replaysOnErrorSampleRate: 1.0,

		// Setting this option to true will send default PII data to Sentry
		// (e.g., IP addresses, user agents)
		sendDefaultPii: true,

		// Environment helps filter issues in Sentry dashboard (development/staging/live)
		environment: env.VITE_ENVIRONMENT,

		integrations: [
			// Browser tracing for performance monitoring
			Sentry.browserTracingIntegration({
				// Trace navigation and interactions
				enableInp: true,
			}),

			// Session replay for debugging
			Sentry.replayIntegration({
				// Mask all text and input content by default for privacy
				maskAllText: true,
				blockAllMedia: true,
			}),

			// Automatically capture console.log, console.warn, and console.error as logs
			Sentry.consoleLoggingIntegration({
				levels: ["log", "warn", "error"],
			}),
		],
	});
}
