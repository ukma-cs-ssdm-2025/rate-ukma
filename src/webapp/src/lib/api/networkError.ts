import axios from "axios";

export const CONNECTION_ERROR_PATH = "/connection-error";

export type ConnectionIssueReason = "offline" | "server" | "unknown";

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

	globalThis.location.replace(url.toString());
};

const getConnectionIssueReason = (
	cause: unknown,
): ConnectionIssueReason | null => {
	if (!axios.isAxiosError(cause) || axios.isCancel(cause)) {
		return null;
	}

	if (!cause.response) {
		return isOffline() ? "offline" : "server";
	}
	if (cause.code === "ERR_NETWORK") {
		return isOffline() ? "offline" : "server";
	}

	return null;
};

/** Extract the HTTP status from a thrown value, when it is an axios error. */
export const getHttpErrorStatus = (cause: unknown): number | undefined => {
	if (!axios.isAxiosError(cause)) return undefined;
	return cause.response?.status ?? cause.status;
};

/**
 * Handles connection issues by detecting the error type and redirecting to the error page.
 * Returns true if the error was a connection issue and handled, false otherwise.
 *
 * @param cause - The error to check
 * @param redirect - Optional redirect function for testing purposes
 */
export const handleConnectionIssue = (
	cause: unknown,
	redirect = redirectToConnectionError,
): boolean => {
	const reason = getConnectionIssueReason(cause);
	if (!reason) {
		return false;
	}

	redirect(reason);
	return true;
};

export const isOffline = () => {
	return navigator.onLine === false;
};
