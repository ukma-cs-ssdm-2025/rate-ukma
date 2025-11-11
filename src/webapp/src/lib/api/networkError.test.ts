import axios, { type AxiosError } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { stubBrowserLocation } from "./browserMocks.test-support";
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

type AxiosErrorOverrides = Partial<AxiosError>;

const createAxiosError = (overrides: AxiosErrorOverrides): AxiosError => {
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
		const { replace } = stubBrowserLocation({
			pathname: DEFAULT_WINDOW_LOCATION.pathname,
			search: DEFAULT_WINDOW_LOCATION.search,
			hash: DEFAULT_WINDOW_LOCATION.hash,
			origin: "http://localhost:3000",
		});
		mockWindowReplace = replace;
	});

	afterEach(() => {
		resetRedirectFlag();
		vi.unstubAllGlobals();
	});

	describe("handleConnectionIssue", () => {
		it("redirects with offline reason when navigator reports offline", () => {
			// Arrange
			stubNavigatorOnline(false);
			const axiosError = createAxiosError({ response: undefined });

			// Act
			const handled = handleConnectionIssue(axiosError);

			// Assert
			expect(handled).toBe(true);
			expectConnectionErrorRedirect("offline");
		});

		it("redirects with server reason when response status is 5xx", () => {
			// Arrange
			stubNavigatorOnline();
			const axiosError = createAxiosError({
				response: { status: 503 } as AxiosError["response"],
			});

			// Act
			const handled = handleConnectionIssue(axiosError);

			// Assert
			expect(handled).toBe(true);
			expectConnectionErrorRedirect("server");
		});

		it("redirects with offline reason when ERR_NETWORK occurs and user is offline", () => {
			// Arrange
			stubNavigatorOnline(false);
			const axiosError = createAxiosError({
				code: "ERR_NETWORK",
				response: undefined,
			});

			// Act
			const handled = handleConnectionIssue(axiosError);

			// Assert
			expect(handled).toBe(true);
			expectConnectionErrorRedirect("offline");
		});

		it("returns false when the error is not an axios error", () => {
			// Arrange
			stubNavigatorOnline();

			// Act
			const handled = handleConnectionIssue(new Error("boom"));

			// Assert
			expect(handled).toBe(false);
			expect(mockWindowReplace).not.toHaveBeenCalled();
		});

		it("ignores canceled axios requests identified by code", () => {
			// Arrange
			stubNavigatorOnline();
			const axiosError = createAxiosError({ code: "ERR_CANCELED" });
			const cancelSpy = vi.spyOn(axios, "isCancel").mockReturnValue(true);

			// Act
			const handled = handleConnectionIssue(axiosError);
			cancelSpy.mockRestore();

			// Assert
			expect(handled).toBe(false);
			expect(mockWindowReplace).not.toHaveBeenCalled();
		});

		it("ignores axios cancel instances even without a specific code", () => {
			// Arrange
			stubNavigatorOnline();
			const axiosError = createAxiosError({});
			const cancelSpy = vi.spyOn(axios, "isCancel").mockReturnValue(true);

			// Act
			const handled = handleConnectionIssue(axiosError);
			cancelSpy.mockRestore();

			// Assert
			expect(handled).toBe(false);
			expect(mockWindowReplace).not.toHaveBeenCalled();
		});

		it("returns false when response status is 4xx", () => {
			// Arrange
			stubNavigatorOnline();
			const axiosError = createAxiosError({
				response: { status: 404 } as AxiosError["response"],
			});

			// Act
			const handled = handleConnectionIssue(axiosError);

			// Assert
			expect(handled).toBe(false);
			expect(mockWindowReplace).not.toHaveBeenCalled();
		});

		it("redirects with server reason when ERR_NETWORK happens but user is online", () => {
			// Arrange
			stubNavigatorOnline(true);
			const axiosError = createAxiosError({
				code: "ERR_NETWORK",
				response: undefined,
			});

			// Act
			const handled = handleConnectionIssue(axiosError);

			// Assert
			expect(handled).toBe(true);
			expectConnectionErrorRedirect("server");
		});

		describe("redirect behavior", () => {
			it("actually redirects using window.location.replace when using default redirect", () => {
				// Arrange
				stubNavigatorOnline();
				const axiosError = createAxiosError({
					response: { status: 503 } as AxiosError["response"],
				});

				// Act
				handleConnectionIssue(axiosError);

				// Assert
				expect(mockWindowReplace).toHaveBeenCalledOnce();
				expectConnectionErrorRedirect("server");
			});

			it("prevents multiple redirects from race conditions", () => {
				// Arrange
				stubNavigatorOnline();
				const error1 = createAxiosError({
					response: { status: 503 } as AxiosError["response"],
				});
				const error2 = createAxiosError({
					response: { status: 500 } as AxiosError["response"],
				});

				// Act
				handleConnectionIssue(error1);
				handleConnectionIssue(error2);

				// Assert
				expect(mockWindowReplace).toHaveBeenCalledOnce();
			});

			it("does not redirect if already on connection error page", () => {
				// Arrange
				const { replace } = stubBrowserLocation({
					pathname: CONNECTION_ERROR_PATH,
					search: "",
					hash: "",
					origin: "http://localhost:3000",
				});
				mockWindowReplace = replace;
				stubNavigatorOnline();
				const axiosError = createAxiosError({
					response: { status: 503 } as AxiosError["response"],
				});

				// Act
				handleConnectionIssue(axiosError);

				// Assert
				expect(mockWindowReplace).not.toHaveBeenCalled();
			});

			it("allows redirect after resetRedirectFlag is called", () => {
				// Arrange
				stubNavigatorOnline();
				const error1 = createAxiosError({
					response: { status: 503 } as AxiosError["response"],
				});
				const error2 = createAxiosError({
					response: { status: 500 } as AxiosError["response"],
				});

				// Act
				handleConnectionIssue(error1);
				handleConnectionIssue(error2);
				resetRedirectFlag();
				handleConnectionIssue(error2);

				// Assert
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
