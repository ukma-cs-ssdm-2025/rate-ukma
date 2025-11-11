import type { AxiosError } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	CONNECTION_ERROR_PATH,
	handleConnectionIssue,
	isOffline,
	resetRedirectFlag,
} from "./networkError";

const DEFAULT_WINDOW_LOCATION = {
	pathname: "/some-page",
	search: "?foo=bar",
	hash: "#section",
} as const;
const DEFAULT_REDIRECT_SOURCE = `${DEFAULT_WINDOW_LOCATION.pathname}${DEFAULT_WINDOW_LOCATION.search}${DEFAULT_WINDOW_LOCATION.hash}`;

const createAxiosError = (overrides: Partial<AxiosError>): AxiosError => {
	return {
		isAxiosError: true,
		toJSON: () => ({}),
		name: "AxiosError",
		message: "Axios error",
		config: {},
		...overrides,
	} as AxiosError;
};

const stubNavigatorOnline = (onLine = true) =>
	vi.stubGlobal("navigator", { onLine } as Navigator);

const callHandleConnectionIssueWithAxios = (
	overrides: Partial<AxiosError>,
	onLine = true,
) => {
	stubNavigatorOnline(onLine);
	const redirectSpy = vi.fn();
	const handled = handleConnectionIssue(
		createAxiosError(overrides),
		redirectSpy,
	);
	return { handled, redirectSpy };
};

const expectRedirect = (
	description: string,
	overrides: Partial<AxiosError>,
	reason: "offline" | "server",
	onLine?: boolean,
) => {
	it(description, () => {
		const { handled, redirectSpy } = callHandleConnectionIssueWithAxios(
			overrides,
			onLine,
		);

		expect(handled).toBe(true);
		expect(redirectSpy).toHaveBeenCalledOnce();
		expect(redirectSpy).toHaveBeenCalledWith(reason);
	});
};

const expectNoRedirect = (
	description: string,
	overrides: Partial<AxiosError>,
	onLine?: boolean,
) => {
	it(description, () => {
		const { handled, redirectSpy } = callHandleConnectionIssueWithAxios(
			overrides,
			onLine,
		);

		expect(handled).toBe(false);
		expect(redirectSpy).not.toHaveBeenCalled();
	});
};

describe("networkError", () => {
	let mockWindowReplace: ReturnType<typeof vi.fn>;
	const expectConnectionErrorRedirect = (
		expectedReason: string,
		expectedFrom = DEFAULT_REDIRECT_SOURCE,
	) => {
		expect(mockWindowReplace).toHaveBeenCalledOnce();
		const redirectUrl = new URL(mockWindowReplace.mock.calls[0][0]);
		expect(redirectUrl.pathname).toBe(CONNECTION_ERROR_PATH);
		expect(redirectUrl.searchParams.get("reason")).toBe(expectedReason);
		expect(redirectUrl.searchParams.get("from")).toBe(expectedFrom);
	};

	beforeEach(() => {
		mockWindowReplace = vi.fn();
		vi.stubGlobal("window", {
			location: {
				...DEFAULT_WINDOW_LOCATION,
				origin: "http://localhost:3000",
				replace: mockWindowReplace,
			},
		});
	});

	afterEach(() => {
		resetRedirectFlag();
		vi.unstubAllGlobals();
	});

	describe("handleConnectionIssue", () => {
		expectRedirect(
			"redirects with offline reason when navigator reports offline",
			{ response: undefined },
			"offline",
			false,
		);
		expectRedirect(
			"redirects with server reason when response status is 5xx",
			{ response: { status: 503 } as AxiosError["response"] },
			"server",
		);
		expectRedirect(
			"redirects with server reason when axios rejects with ERR_NETWORK and no response",
			{ response: undefined, code: "ERR_NETWORK" },
			"server",
		);

		it("returns false when the error is not an axios error", () => {
			stubNavigatorOnline();
			const redirectSpy = vi.fn();

			const handled = handleConnectionIssue(new Error("boom"), redirectSpy);

			expect(handled).toBe(false);
			expect(redirectSpy).not.toHaveBeenCalled();
		});

		expectNoRedirect("ignores canceled axios requests identified by code", {
			code: "ERR_CANCELED",
			__CANCEL__: true,
		});
		expectNoRedirect(
			"ignores axios cancel instances even without a specific code",
			{ __CANCEL__: true },
		);
		expectNoRedirect("returns false when response status is 4xx", {
			response: { status: 404 } as AxiosError["response"],
		});
		expectRedirect(
			"redirects with server reason when ERR_NETWORK but user is online",
			{ code: "ERR_NETWORK", response: undefined },
			"server",
		);

		describe("redirect behavior", () => {
			it("actually redirects using window.location.replace when using default redirect", () => {
				const axiosError = createAxiosError({
					response: { status: 503 } as AxiosError["response"],
				});
				stubNavigatorOnline();

				handleConnectionIssue(axiosError);

				expect(mockWindowReplace).toHaveBeenCalledOnce();
				expectConnectionErrorRedirect("server");
			});

			it("prevents multiple redirects from race conditions", () => {
				const error1 = createAxiosError({
					response: { status: 503 } as AxiosError["response"],
				});
				const error2 = createAxiosError({
					response: { status: 500 } as AxiosError["response"],
				});
				stubNavigatorOnline();

				handleConnectionIssue(error1);
				handleConnectionIssue(error2);

				expect(mockWindowReplace).toHaveBeenCalledOnce();
			});

			it("does not redirect if already on connection error page", () => {
				vi.stubGlobal("window", {
					location: {
						pathname: CONNECTION_ERROR_PATH,
						search: "",
						hash: "",
						origin: "http://localhost:3000",
						replace: mockWindowReplace,
					},
				});
				const axiosError = createAxiosError({
					response: { status: 503 } as AxiosError["response"],
				});
				stubNavigatorOnline();

				handleConnectionIssue(axiosError);

				expect(mockWindowReplace).not.toHaveBeenCalled();
			});

			it("allows redirect after resetRedirectFlag is called", () => {
				const error1 = createAxiosError({
					response: { status: 503 } as AxiosError["response"],
				});
				const error2 = createAxiosError({
					response: { status: 500 } as AxiosError["response"],
				});
				stubNavigatorOnline();

				handleConnectionIssue(error1);
				expect(mockWindowReplace).toHaveBeenCalledOnce();

				handleConnectionIssue(error2);
				expect(mockWindowReplace).toHaveBeenCalledOnce();

				resetRedirectFlag();

				handleConnectionIssue(error2);

				expect(mockWindowReplace).toHaveBeenCalledTimes(2);
			});
		});
	});

	describe("isOffline", () => {
		it("returns true when navigator.onLine is false", () => {
			stubNavigatorOnline(false);

			const result = isOffline();

			expect(result).toBe(true);
		});

		it("returns false when navigator.onLine is true", () => {
			stubNavigatorOnline(true);

			const result = isOffline();

			expect(result).toBe(false);
		});
	});
});
