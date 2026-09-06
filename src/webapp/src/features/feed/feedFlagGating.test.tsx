import type { ReactNode } from "react";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { FeedStrip } from "@/features/feed/components/FeedStrip";
import { FeedRoute } from "@/routes/feed";
import { renderWithProviders, screen, waitFor } from "@/test-utils/render";

const { fetcherMock } = vi.hoisted(() => ({
	fetcherMock: vi.fn(),
}));

// The real `useFeed` runs here (unlike the component tests, which stub it), so
// the flag-to-request wiring is what is under test. Mocking the HTTP mutator
// rather than a generated export keeps the generated hook in the path.
vi.mock("@/lib/api/apiClient", async () => ({
	...(await vi.importActual("@/lib/api/apiClient")),
	authorizedFetcher: fetcherMock,
}));

vi.mock("@/components/Layout", () => ({
	default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@tanstack/react-router", async () => ({
	...(await vi.importActual("@tanstack/react-router")),
	Link: (await import("@/test-utils/router")).MockLink,
}));

describe("feed flag gating", () => {
	beforeEach(() => {
		fetcherMock.mockReset();
		fetcherMock.mockResolvedValue({ items: [], next_cursor: null });
	});

	it("issues no request from the strip when the feed flag is off", async () => {
		renderWithProviders(<FeedStrip />, { flags: { fe_feed: false } });

		await waitFor(() => expect(fetcherMock).not.toHaveBeenCalled());
	});

	it("issues no request from the strip until the flags have resolved", async () => {
		renderWithProviders(<FeedStrip />, {
			flags: { fe_feed: true },
			flagsReady: false,
		});

		await waitFor(() => expect(fetcherMock).not.toHaveBeenCalled());
	});

	it("issues no request from the feed route when the feed flag is off", async () => {
		renderWithProviders(<FeedRoute />, { flags: { fe_feed: false } });

		expect(screen.getByText("Стрічка наразі недоступна.")).toBeInTheDocument();
		await waitFor(() => expect(fetcherMock).not.toHaveBeenCalled());
	});

	it("requests the feed once the flag is on", async () => {
		renderWithProviders(<FeedRoute />, { flags: { fe_feed: true } });

		await waitFor(() => expect(fetcherMock).toHaveBeenCalled());
	});
});
