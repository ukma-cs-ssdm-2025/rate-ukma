import * as Sentry from "@sentry/react";
import axios, { AxiosHeaders } from "axios";

import { env } from "@/env";
import { handleConnectionIssue } from "./networkError";

export const authorizedHttpClient = axios.create({
	withCredentials: true,
	baseURL: env.VITE_API_BASE_URL,
	timeout: 60000,
});

const unsafeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const CSRF_COOKIE_NAME = "csrftoken";
const CSRF_HEADER_NAME = "X-CSRFToken";

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

	return cookie.substring(CSRF_COOKIE_NAME.length + 1) || null;
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

authorizedHttpClient.interceptors.response.use(
	(response) => response,
	(error) => {
		handleConnectionIssue(error);

		if (axios.isAxiosError(error) && !axios.isCancel(error)) {
			const method = error.config?.method?.toUpperCase();

			Sentry.captureException(error, {
				level: "error",
				tags: {
					httpMethod: method,
					httpStatus: error.response?.status?.toString(),
					axiosErrorCode: error.code,
				},
				extra: {
					url: error.config?.url,
				},
			});
		}

		return Promise.reject(error);
	},
);

export const authorizedFetcher = <TData>(
	config: Parameters<typeof authorizedHttpClient.request<TData>>[0],
) => {
	return authorizedHttpClient.request<TData>(config).then((res) => res.data);
};
