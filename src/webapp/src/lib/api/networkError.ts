import axios from "axios";

export const CONNECTION_ERROR_PATH = "/connection-error";

export type ConnectionIssueReason = "offline" | "server" | "unknown";

export const BOUNCES_PARAM = "bounces";

export const BOUNCE_WINDOW_MS = 10 * 60_000;
const BOUNCE_TS_KEY = "rateukma.connection-error-ts";

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
		return;
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
