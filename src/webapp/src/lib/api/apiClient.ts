import * as Sentry from "@sentry/react";
import axios, { AxiosHeaders } from "axios";

import { env } from "@/env";
import { notifySessionExpired } from "@/lib/auth/sessionExpiry";
import { handleConnectionIssue } from "./networkError";

export const authorizedHttpClient = axios.create({
	withCredentials: true,
	baseURL: env.VITE_API_BASE_URL,
	timeout: 60_000,
	paramsSerializer: {
		indexes: null,
	},
});

const unsafeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const CSRF_COOKIE_NAME = "csrftoken";
const CSRF_HEADER_NAME = "X-CSRFToken";
const LOGIN_PATH_PREFIX = "/login";
const AUTH_PATH_PREFIX = "/auth";
const AUTH_SESSION_ENDPOINT_SUBSTRING = "/auth/session";
const UKMA_DATA_PATH_PREFIX = "/api/v1/ukma-data/";
const UKMA_DATA_SYNC_PATH_PREFIX = "/api/v1/ukma-data/sync/";

const getCsrfToken = () => {
	if (typeof document === "undefined") {
		return null;
	}

	const cookie = document.cookie
		.split("; ")
		.map((cookie) => cookie.trim())
		.find((entry) => entry.startsWith(`${CSRF_COOKIE_NAME}=`));

	if (!cookie) {
		return null;
	}

	return cookie.slice(CSRF_COOKIE_NAME.length + 1) || null;
};

authorizedHttpClient.interceptors.request.use((config) => {
	const headers =
		config.headers instanceof AxiosHeaders
			? config.headers
			: new AxiosHeaders(config.headers);

	headers.set("X-Requested-With", "XMLHttpRequest");

	const method = config.method?.toUpperCase();
	if (method && unsafeMethods.has(method)) {
		const csrfToken = getCsrfToken();
		if (csrfToken) {
			headers.set(CSRF_HEADER_NAME, decodeURIComponent(csrfToken));
		}
	}

	config.headers = headers;
	return config;
});

const handleSessionExpiry = (error: unknown): boolean => {
	if (!axios.isAxiosError(error)) {
		return false;
	}

	const status = error.response?.status;
	const requestUrl = error.config?.url;
	const currentPath = globalThis.location.pathname ?? "";

	if (status !== 401 && status !== 403) {
		return false;
	}
	if (
		currentPath.startsWith(LOGIN_PATH_PREFIX) ||
		currentPath.startsWith(AUTH_PATH_PREFIX)
	) {
		return false;
	}
	if (requestUrl?.includes(AUTH_SESSION_ENDPOINT_SUBSTRING)) {
		return false;
	}
	if (status === 403 && requestUrl?.startsWith(UKMA_DATA_PATH_PREFIX)) {
		return false;
	}

	notifySessionExpired();

	return true;
};

const isSyncDecisionRequest = (error: unknown): boolean => {
	if (!axios.isAxiosError(error)) {
		return false;
	}
	const method = error.config?.method?.toUpperCase();
	return (
		method !== undefined &&
		unsafeMethods.has(method) &&
		error.config?.url?.startsWith(UKMA_DATA_SYNC_PATH_PREFIX) === true
	);
};

const logErrorToSentry = (error: unknown) => {
	if (!axios.isAxiosError(error) || axios.isCancel(error)) {
		return;
	}

	const method = error.config?.method?.toUpperCase();
	const status = error.response?.status;
	const url = error.config?.url;

	if (status === 401 && url?.includes(AUTH_SESSION_ENDPOINT_SUBSTRING)) {
		return;
	}

	Sentry.captureException(new Error(error.message), {
		level: "error",
		tags: {
			httpMethod: method,
			httpStatus: status?.toString(),
			axiosErrorCode: error.code,
		},
		extra: { url },
	});
};

authorizedHttpClient.interceptors.response.use(
	(response) => response,
	(error) => {
		if (!isSyncDecisionRequest(error)) {
			handleConnectionIssue(error);
		}

		const isSessionExpired = handleSessionExpiry(error);

		if (!isSessionExpired) {
			logErrorToSentry(error);
		}

		return Promise.reject(error);
	},
);

export const authorizedFetcher = <TData>(
	config: Parameters<typeof authorizedHttpClient.request<TData>>[0],
) => {
	return authorizedHttpClient.request<TData>(config).then((res) => res.data);
};
