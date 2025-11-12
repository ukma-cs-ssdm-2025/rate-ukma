import "@testing-library/jest-dom/vitest";

import { useState } from "react";

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MockAdapter from "axios-mock-adapter";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { authorizedHttpClient } from "./apiClient";
import { stubBrowserLocation } from "./browserMocks.test-support";
import { CONNECTION_ERROR_PATH, resetRedirectFlag } from "./networkError";

const expectConnectionErrorRedirect = (
	mockWindowReplace: ReturnType<typeof vi.fn>,
	expectedReason: string,
	expectedFrom = DEFAULT_REDIRECT_SOURCE,
) => {
	expect(mockWindowReplace).toHaveBeenCalledOnce();
	const redirectUrl = new URL(mockWindowReplace.mock.calls[0][0]);
	expect(redirectUrl.pathname).toBe(CONNECTION_ERROR_PATH);
	expect(redirectUrl.searchParams.get("reason")).toBe(expectedReason);
	expect(redirectUrl.searchParams.get("from")).toBe(expectedFrom);
};

const DEFAULT_WINDOW_LOCATION = {
	pathname: "/courses",
	search: "?page=1",
	hash: "#top",
} as const;
const DEFAULT_REDIRECT_SOURCE = `${DEFAULT_WINDOW_LOCATION.pathname}${DEFAULT_WINDOW_LOCATION.search}${DEFAULT_WINDOW_LOCATION.hash}`;

interface TestComponentProps {
	endpoint: string;
}

function TestComponent({ endpoint }: Readonly<TestComponentProps>) {
	const [data, setData] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	const fetchData = async () => {
		setLoading(true);
		setError(null);
		try {
			const response = await authorizedHttpClient.get(endpoint);
			setData(response.data);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Unknown error");
		} finally {
			setLoading(false);
		}
	};

	return (
		<div>
			<button type="button" onClick={fetchData}>
				Fetch Data
			</button>
			{loading && <p>Loading...</p>}
			{data && <p>Data: {data}</p>}
			{error && <p>Error: {error}</p>}
		</div>
	);
}

describe("Network Error Handling - Full Integration", () => {
	let mockWindowReplace: ReturnType<typeof vi.fn>;
	let mockAxios: MockAdapter;

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
		cleanup();
		resetRedirectFlag();
		mockAxios.restore();
		vi.unstubAllGlobals();
		vi.clearAllMocks();
	});

	it("redirects to error page when API call fails due to network issues", async () => {
		// Arrange
		const user = userEvent.setup();
		mockAxios.onGet("/api/courses").networkError();

		render(<TestComponent endpoint="/api/courses" />);

		// Act
		const button = screen.getByRole("button", { name: /Fetch Data/i });
		await user.click(button);

		// Assert
		await vi.waitFor(() => {
			expect(mockWindowReplace).toHaveBeenCalledOnce();
		});
		expectConnectionErrorRedirect(mockWindowReplace, "server");
	});

	it("redirects with offline reason when user is offline", async () => {
		// Arrange
		const user = userEvent.setup();
		vi.stubGlobal("navigator", { onLine: false } as Navigator);
		mockAxios.onGet("/api/data").networkError();

		render(<TestComponent endpoint="/api/data" />);

		// Act
		const button = screen.getByRole("button", { name: /Fetch Data/i });
		await user.click(button);

		// Assert
		await vi.waitFor(() => {
			expect(mockWindowReplace).toHaveBeenCalledOnce();
		});
		expectConnectionErrorRedirect(mockWindowReplace, "offline");
	});

	it("does not redirect on successful API call", async () => {
		// Arrange
		const user = userEvent.setup();
		mockAxios.onGet("/api/data").reply(200, "success");

		render(<TestComponent endpoint="/api/data" />);

		// Act
		const button = screen.getByRole("button", { name: /Fetch Data/i });
		await user.click(button);

		// Assert
		await vi.waitFor(() => {
			expect(screen.getByText("Data: success")).toBeInTheDocument();
		});
		expect(mockWindowReplace).not.toHaveBeenCalled();
	});

	it("does not redirect on 404 errors", async () => {
		// Arrange
		const user = userEvent.setup();
		mockAxios.onGet("/api/nonexistent").reply(404);

		render(<TestComponent endpoint="/api/nonexistent" />);

		// Act
		const button = screen.getByRole("button", { name: /Fetch Data/i });
		await user.click(button);

		// Assert
		await vi.waitFor(() => {
			expect(screen.getByText(/Error:/)).toBeInTheDocument();
		});
		expect(mockWindowReplace).not.toHaveBeenCalled();
	});

	it("simulates user on authenticated page (courses) making request that triggers connection error", async () => {
		// Arrange
		const user = userEvent.setup();
		const { replace } = stubBrowserLocation({
			pathname: "/courses",
			search: "?sort=active",
			hash: "#top",
			origin: "http://localhost:3000",
		});
		mockWindowReplace = replace;

		mockAxios.onGet("/api/user/dashboard").networkError();

		render(<TestComponent endpoint="/api/user/dashboard" />);

		// Act
		const button = screen.getByRole("button", { name: /Fetch Data/i });
		await user.click(button);

		// Assert
		await vi.waitFor(() => {
			expect(mockWindowReplace).toHaveBeenCalledOnce();
		});
		expectConnectionErrorRedirect(
			mockWindowReplace,
			"server",
			"/courses?sort=active#top",
		);
	});
});
