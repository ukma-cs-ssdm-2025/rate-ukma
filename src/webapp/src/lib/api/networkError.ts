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

export const redirectToConnectionErrorPage = (
	reason: ConnectionIssueReason = "server",
) => {
	redirectToConnectionError(reason);
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
