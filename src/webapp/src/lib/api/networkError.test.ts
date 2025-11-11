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
		it("redirects with offline reason when navigator reports offline", () => {
			// Arrange
			const redirectSpy = vi.fn();
			const axiosError = createAxiosError({ response: undefined });
			vi.stubGlobal("navigator", { onLine: false } as Navigator);

			// Act
			const handled = handleConnectionIssue(axiosError, redirectSpy);

			// Assert
			expect(handled).toBe(true);
			expect(redirectSpy).toHaveBeenCalledOnce();
			expect(redirectSpy).toHaveBeenCalledWith("offline");
		});

		it("redirects with server reason when response status is 5xx", () => {
			// Arrange
			const redirectSpy = vi.fn();
			const axiosError = createAxiosError({
				response: { status: 503 } as AxiosError["response"],
			});
			vi.stubGlobal("navigator", { onLine: true } as Navigator);

			// Act
			const handled = handleConnectionIssue(axiosError, redirectSpy);

			// Assert
			expect(handled).toBe(true);
			expect(redirectSpy).toHaveBeenCalledOnce();
			expect(redirectSpy).toHaveBeenCalledWith("server");
		});

		it("redirects with server reason when axios rejects with ERR_NETWORK and no response", () => {
			// Arrange
			const redirectSpy = vi.fn();
			const axiosError = createAxiosError({
				response: undefined,
				code: "ERR_NETWORK",
			});
			vi.stubGlobal("navigator", { onLine: true } as Navigator);

			// Act
			const handled = handleConnectionIssue(axiosError, redirectSpy);

			// Assert
			expect(handled).toBe(true);
			expect(redirectSpy).toHaveBeenCalledOnce();
			expect(redirectSpy).toHaveBeenCalledWith("server");
		});

		it("returns false when the error is not an axios error", () => {
			// Arrange
			const redirectSpy = vi.fn();
			vi.stubGlobal("navigator", { onLine: true } as Navigator);

			// Act
			const handled = handleConnectionIssue(new Error("boom"), redirectSpy);

			// Assert
			expect(handled).toBe(false);
			expect(redirectSpy).not.toHaveBeenCalled();
		});

		it("ignores canceled axios requests identified by code", () => {
			// Arrange
			const redirectSpy = vi.fn();
			const axiosError = createAxiosError({
				code: "ERR_CANCELED",
				__CANCEL__: true,
			});
			vi.stubGlobal("navigator", { onLine: true } as Navigator);

			// Act
			const handled = handleConnectionIssue(axiosError, redirectSpy);

			// Assert
			expect(handled).toBe(false);
			expect(redirectSpy).not.toHaveBeenCalled();
		});

		it("ignores axios cancel instances even without a specific code", () => {
			// Arrange
			const redirectSpy = vi.fn();
			const axiosError = createAxiosError({
				__CANCEL__: true,
			});
			vi.stubGlobal("navigator", { onLine: true } as Navigator);

			// Act
			const handled = handleConnectionIssue(axiosError, redirectSpy);

			// Assert
			expect(handled).toBe(false);
			expect(redirectSpy).not.toHaveBeenCalled();
		});

		it("returns false when response status is 4xx", () => {
			// Arrange
			const redirectSpy = vi.fn();
			const axiosError = createAxiosError({
				response: { status: 404 } as AxiosError["response"],
			});
			vi.stubGlobal("navigator", { onLine: true } as Navigator);

			// Act
			const handled = handleConnectionIssue(axiosError, redirectSpy);

			// Assert
			expect(handled).toBe(false);
			expect(redirectSpy).not.toHaveBeenCalled();
		});

		it("redirects with offline reason when no response and user is offline", () => {
			// Arrange
			const redirectSpy = vi.fn();
			const axiosError = createAxiosError({ response: undefined });
			vi.stubGlobal("navigator", { onLine: false } as Navigator);

			// Act
			const handled = handleConnectionIssue(axiosError, redirectSpy);

			// Assert
			expect(handled).toBe(true);
			expect(redirectSpy).toHaveBeenCalledOnce();
			expect(redirectSpy).toHaveBeenCalledWith("offline");
		});

		it("redirects with server reason when ERR_NETWORK but user is online", () => {
			// Arrange
			const redirectSpy = vi.fn();
			const axiosError = createAxiosError({
				code: "ERR_NETWORK",
				response: undefined,
			});
			vi.stubGlobal("navigator", { onLine: true } as Navigator);

			// Act
			const handled = handleConnectionIssue(axiosError, redirectSpy);

			// Assert
			expect(handled).toBe(true);
			expect(redirectSpy).toHaveBeenCalledOnce();
			expect(redirectSpy).toHaveBeenCalledWith("server");
		});

		describe("redirect behavior", () => {
			it("actually redirects using window.location.replace when using default redirect", () => {
				// Arrange
				const axiosError = createAxiosError({
					response: { status: 503 } as AxiosError["response"],
				});
				vi.stubGlobal("navigator", { onLine: true } as Navigator);

				// Act
				handleConnectionIssue(axiosError);

				// Assert
				expect(mockWindowReplace).toHaveBeenCalledOnce();
				expectConnectionErrorRedirect("server");
			});

			it("prevents multiple redirects from race conditions", () => {
				// Arrange
				const error1 = createAxiosError({
					response: { status: 503 } as AxiosError["response"],
				});
				const error2 = createAxiosError({
					response: { status: 500 } as AxiosError["response"],
				});
				vi.stubGlobal("navigator", { onLine: true } as Navigator);

				// Act
				handleConnectionIssue(error1);
				handleConnectionIssue(error2);

				// Assert
				expect(mockWindowReplace).toHaveBeenCalledOnce();
			});

			it("does not redirect if already on connection error page", () => {
				// Arrange
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
				vi.stubGlobal("navigator", { onLine: true } as Navigator);

				// Act
				handleConnectionIssue(axiosError);

				// Assert
				expect(mockWindowReplace).not.toHaveBeenCalled();
			});

			it("allows redirect after resetRedirectFlag is called", () => {
				// Arrange
				const error1 = createAxiosError({
					response: { status: 503 } as AxiosError["response"],
				});
				const error2 = createAxiosError({
					response: { status: 500 } as AxiosError["response"],
				});
				vi.stubGlobal("navigator", { onLine: true } as Navigator);

				// Act
				handleConnectionIssue(error1);
				expect(mockWindowReplace).toHaveBeenCalledOnce();

				handleConnectionIssue(error2);
				expect(mockWindowReplace).toHaveBeenCalledOnce();

				resetRedirectFlag();

				handleConnectionIssue(error2);

				// Assert
				expect(mockWindowReplace).toHaveBeenCalledTimes(2);
			});
		});
	});

	describe("isOffline", () => {
		it("returns true when navigator.onLine is false", () => {
			// Arrange
			vi.stubGlobal("navigator", { onLine: false } as Navigator);

			// Act
			const result = isOffline();

			// Assert
			expect(result).toBe(true);
		});

		it("returns false when navigator.onLine is true", () => {
			// Arrange
			vi.stubGlobal("navigator", { onLine: true } as Navigator);

			// Act
			const result = isOffline();

			// Assert
			expect(result).toBe(false);
		});
	});
});

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
