import type { Telemetry } from "./types";

/** What runs when no DSN is configured: local dev, e2e, and any self-host. */
export const noop: Telemetry = {
	init: () => {},
	captureError: () => {},
	track: () => {},
	measure: () => {},
	setUser: () => {},
};
