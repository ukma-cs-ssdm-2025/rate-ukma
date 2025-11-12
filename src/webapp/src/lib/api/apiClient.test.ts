import MockAdapter from "axios-mock-adapter";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { authorizedHttpClient } from "./apiClient";
import { stubBrowserLocation } from "./browserMocks.test-support";
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
		const { replace } = stubBrowserLocation({
			pathname: DEFAULT_WINDOW_LOCATION.pathname,
			search: DEFAULT_WINDOW_LOCATION.search,
			hash: DEFAULT_WINDOW_LOCATION.hash,
			origin: "http://localhost:3000",
		});
		mockWindowReplace = replace;
		vi.stubGlobal("navigator", { onLine: true } as Navigator);

		mockAxios = new MockAdapter(authorizedHttpClient);
	});

	afterEach(() => {
		resetRedirectFlag();
		mockAxios.restore();
		vi.unstubAllGlobals();
		vi.clearAllMocks();
	});

	it("does not redirect on 500 server errors", async () => {
		// Arrange
		mockAxios.onGet("/api/test").reply(500);

		// Act
		const request = authorizedHttpClient.get("/api/test");

		// Assert
		await expect(request).rejects.toMatchObject({ response: { status: 500 } });
		expect(mockWindowReplace).not.toHaveBeenCalled();
	});

	it("does not redirect on 503 service unavailable errors", async () => {
		// Arrange
		mockAxios.onGet("/api/courses").reply(503);

		// Act
		const request = authorizedHttpClient.get("/api/courses");

		// Assert
		await expect(request).rejects.toMatchObject({ response: { status: 503 } });
		expect(mockWindowReplace).not.toHaveBeenCalled();
	});

	it("redirects with offline reason when network error occurs and user is offline", async () => {
		// Arrange
		vi.stubGlobal("navigator", { onLine: false } as Navigator);
		mockAxios.onGet("/api/test").networkError();

		// Act
		const request = authorizedHttpClient.get("/api/test");

		// Assert
		await expect(request).rejects.toBeDefined();
		expectConnectionErrorRedirect("offline");
	});

	it("redirects with server reason when network error occurs but user is online", async () => {
		// Arrange
		mockAxios.onGet("/api/test").networkError();

		// Act
		const request = authorizedHttpClient.get("/api/test");

		// Assert
		await expect(request).rejects.toBeDefined();
		expectConnectionErrorRedirect("server");
	});

	it("does not redirect on successful API call", async () => {
		// Arrange
		mockAxios.onGet("/api/success").reply(200, { ok: true });

		// Act
		const request = authorizedHttpClient.get("/api/success");

		// Assert
		await expect(request).resolves.toMatchObject({ data: { ok: true } });
		expect(mockWindowReplace).not.toHaveBeenCalled();
	});

	it("does not redirect on 4xx client errors", async () => {
		// Arrange
		mockAxios.onGet("/api/nonexistent").reply(404);

		// Act
		const request = authorizedHttpClient.get("/api/nonexistent");

		// Assert
		await expect(request).rejects.toMatchObject({
			response: { status: 404 },
		});
		expect(mockWindowReplace).not.toHaveBeenCalled();
	});

	it("does not redirect on 401 unauthorized errors", async () => {
		// Arrange
		mockAxios.onGet("/api/protected").reply(401);

		// Act
		const request = authorizedHttpClient.get("/api/protected");

		// Assert
		await expect(request).rejects.toMatchObject({
			response: { status: 401 },
		});
		expect(mockWindowReplace).not.toHaveBeenCalled();
	});

	it("prevents multiple redirects from race condition", async () => {
		// Arrange
		mockAxios.onGet("/api/test1").networkError();
		mockAxios.onGet("/api/test2").networkError();

		// Act
		const results = await Promise.allSettled([
			authorizedHttpClient.get("/api/test1"),
			authorizedHttpClient.get("/api/test2"),
		]);

		// Assert
		expect(results.every((result) => result.status === "rejected")).toBe(true);
		expect(mockWindowReplace).toHaveBeenCalledOnce();
	});

	it("still rejects the promise after handling connection issue", async () => {
		// Arrange
		mockAxios.onGet("/api/test").reply(500);

		// Act
		const request = authorizedHttpClient.get("/api/test");

		// Assert
		await expect(request).rejects.toMatchObject({ response: { status: 500 } });
	});
});
