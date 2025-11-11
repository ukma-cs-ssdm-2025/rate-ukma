import MockAdapter from "axios-mock-adapter";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { authorizedHttpClient } from "./apiClient";
import { CONNECTION_ERROR_PATH, resetRedirectFlag } from "./networkError";

const DEFAULT_WINDOW_LOCATION = {
	pathname: "/courses",
	search: "?page=2",
	hash: "#top",
} as const;
const DEFAULT_REDIRECT_SOURCE = `${DEFAULT_WINDOW_LOCATION.pathname}${DEFAULT_WINDOW_LOCATION.search}${DEFAULT_WINDOW_LOCATION.hash}`;

describe("apiClient axios interceptor integration", () => {
	let mockWindowReplace: ReturnType<typeof vi.fn>;
	let mockAxios: MockAdapter;
	const expectConnectionErrorRedirect = (expectedReason: string) => {
		expect(mockWindowReplace).toHaveBeenCalledOnce();
		const redirectUrl = new URL(mockWindowReplace.mock.calls[0][0]);
		expect(redirectUrl.pathname).toBe(CONNECTION_ERROR_PATH);
		expect(redirectUrl.searchParams.get("reason")).toBe(expectedReason);
		expect(redirectUrl.searchParams.get("from")).toBe(DEFAULT_REDIRECT_SOURCE);
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
		vi.stubGlobal("navigator", { onLine: true } as Navigator);

		mockAxios = new MockAdapter(authorizedHttpClient);
	});

	afterEach(() => {
		resetRedirectFlag();
		mockAxios.restore();
		vi.unstubAllGlobals();
		vi.clearAllMocks();
	});

	it("redirects to connection-error page when API returns 500", async () => {
		// Arrange
		mockAxios.onGet("/api/test").reply(500);

		// Act
		try {
			await authorizedHttpClient.get("/api/test");
		} catch (_error) {}

		// Assert
		expectConnectionErrorRedirect("server");
	});

	it("redirects to connection-error page when API returns 503", async () => {
		// Arrange
		mockAxios.onGet("/api/courses").reply(503);

		// Act
		try {
			await authorizedHttpClient.get("/api/courses");
		} catch (_error) {}

		// Assert
		expectConnectionErrorRedirect("server");
	});

	it("redirects with offline reason when network error occurs and user is offline", async () => {
		// Arrange
		vi.stubGlobal("navigator", { onLine: false } as Navigator);
		mockAxios.onGet("/api/test").networkError();

		// Act
		try {
			await authorizedHttpClient.get("/api/test");
		} catch (_error) {}

		// Assert
		expectConnectionErrorRedirect("offline");
	});

	it("redirects with server reason when network error occurs but user is online", async () => {
		// Arrange
		mockAxios.onGet("/api/test").networkError();

		// Act
		try {
			await authorizedHttpClient.get("/api/test");
		} catch (_error) {}

		// Assert
		expectConnectionErrorRedirect("server");
	});

	it("does not redirect on 4xx client errors", async () => {
		// Arrange
		mockAxios.onGet("/api/nonexistent").reply(404);

		// Act
		try {
			await authorizedHttpClient.get("/api/nonexistent");
		} catch (_error) {}

		// Assert
		expect(mockWindowReplace).not.toHaveBeenCalled();
	});

	it("does not redirect on 401 unauthorized errors", async () => {
		// Arrange
		mockAxios.onGet("/api/protected").reply(401);

		// Act
		try {
			await authorizedHttpClient.get("/api/protected");
		} catch (_error) {}

		// Assert
		expect(mockWindowReplace).not.toHaveBeenCalled();
	});

	it("prevents multiple redirects from race condition", async () => {
		// Arrange
		mockAxios.onGet("/api/test1").reply(500);
		mockAxios.onGet("/api/test2").reply(503);

		// Act
		await Promise.allSettled([
			authorizedHttpClient.get("/api/test1"),
			authorizedHttpClient.get("/api/test2"),
		]);

		// Assert
		expect(mockWindowReplace).toHaveBeenCalledOnce();
	});

	it("still rejects the promise after handling connection issue", async () => {
		// Arrange
		mockAxios.onGet("/api/test").reply(500);

		// Act & Assert
		await expect(authorizedHttpClient.get("/api/test")).rejects.toMatchObject({
			response: { status: 500 },
		});
	});
});
