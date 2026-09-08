import axios from "axios";

export const CONNECTION_ERROR_PATH = "/connection-error";

export type ConnectionIssueReason = "offline" | "server" | "unknown";

export const BOUNCES_PARAM = "bounces";

/**
 * Bounces only count as one outage while failures arrive back-to-back. The
 * cycle start lives in sessionStorage (per tab) rather than the URL: a
 * lingering ?bounces=N from an old outage ages out instead of disabling
 * auto-return on the next, unrelated one.
 */
export const BOUNCE_WINDOW_MS = 10 * 60_000;
const BOUNCE_TS_KEY = "rateukma.connection-error-ts";

/**
 * Reads the bounce counter from a raw param value.
 * Anything missing or unparseable counts as zero so a hand-typed URL
 * never breaks the page.
 */
export const parseBounceCount = (value?: string | null): number => {
	const parsed = Number.parseInt(value ?? "", 10);
	return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
};

const readCycleStart = (): number => {
	try {
		const parsed = Number.parseInt(
			sessionStorage.getItem(BOUNCE_TS_KEY) ?? "",
			10,
		);
		return Number.isInteger(parsed) ? parsed : 0;
	} catch {
		// Storage unavailable (private mode): every redirect starts a new cycle.
		return 0;
	}
};

const nextBounceCount = (now: number): number => {
	if (now - readCycleStart() > BOUNCE_WINDOW_MS) {
		return 1;
	}
	return (
		parseBounceCount(
			new URLSearchParams(globalThis.location.search).get(BOUNCES_PARAM),
		) + 1
	);
};

const stampCycleStart = (now: number): void => {
	try {
		sessionStorage.setItem(BOUNCE_TS_KEY, String(now));
	} catch {
		// Storage unavailable (private mode): the counter still works,
		// it just never spans more than one redirect.
	}
};

let isRedirecting = false;

export const resetRedirectFlag = () => {
	isRedirecting = false;
};

const redirectToConnectionError = (
	reason: ConnectionIssueReason = "server",
) => {
	if (isRedirecting) {
		return;
	}

	isRedirecting = true;

	const currentPath = location.pathname;
	if (currentPath === CONNECTION_ERROR_PATH) {
		resetRedirectFlag();
		return;
	}

	const search = globalThis.location.search ?? "";
	const hash = globalThis.location.hash ?? "";
	const from = `${currentPath}${search}${hash}`;

	const url = new URL(CONNECTION_ERROR_PATH, globalThis.location.origin);
	url.searchParams.set("reason", reason);
	url.searchParams.set("from", from);
	url.searchParams.set(BOUNCES_PARAM, String(nextBounceCount(Date.now())));
	stampCycleStart(Date.now());

	globalThis.location.replace(url.toString());
};

const getConnectionIssueReason = (
	error: unknown,
): ConnectionIssueReason | null => {
	if (!axios.isAxiosError(error) || axios.isCancel(error)) {
		return null;
	}

	if (!error.response) {
		return isOffline() ? "offline" : "server";
	}
	if (error.code === "ERR_NETWORK") {
		return isOffline() ? "offline" : "server";
	}

	return null;
};

/**
 * Handles connection issues by detecting the error type and redirecting to the error page.
 * Returns true if the error was a connection issue and handled, false otherwise.
 *
 * @param error - The error to check
 * @param redirect - Optional redirect function for testing purposes
 */
export const handleConnectionIssue = (
	error: unknown,
	redirect = redirectToConnectionError,
): boolean => {
	const reason = getConnectionIssueReason(error);
	if (!reason) {
		return false;
	}

	redirect(reason);
	return true;
};

export const isOffline = () => {
	return navigator.onLine === false;
};
