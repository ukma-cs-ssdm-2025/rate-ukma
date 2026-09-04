import type { ReactNode } from "react";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { FeedStrip } from "@/features/feed/components/FeedStrip";
import { FEED_FLAG } from "@/features/feed/feedFlags";
import { FeedRoute } from "@/routes/feed";
import { renderWithProviders, screen, waitFor } from "@/test-utils/render";

const { feedListMock } = vi.hoisted(() => ({
	feedListMock: vi.fn(),
}));

// The real `useFeed` runs here (unlike the component tests, which stub it), so
// the flag-to-request wiring is what is under test.
vi.mock("@/lib/api/generated", async () => ({
	...(await vi.importActual("@/lib/api/generated")),
	feedList: feedListMock,
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
		feedListMock.mockReset();
		feedListMock.mockResolvedValue({ items: [], next_cursor: null });
	});

	it("issues no request from the strip when the feed flag is off", async () => {
		renderWithProviders(<FeedStrip />, { flags: { [FEED_FLAG]: false } });

		await waitFor(() => expect(feedListMock).not.toHaveBeenCalled());
	});

	it("issues no request from the strip until the flags have resolved", async () => {
		renderWithProviders(<FeedStrip />, {
			flags: { [FEED_FLAG]: true },
			flagsReady: false,
		});

		await waitFor(() => expect(feedListMock).not.toHaveBeenCalled());
	});

	it("issues no request from the feed route when the feed flag is off", async () => {
		renderWithProviders(<FeedRoute />, { flags: { [FEED_FLAG]: false } });

		expect(screen.getByText("Стрічка наразі недоступна.")).toBeInTheDocument();
		await waitFor(() => expect(feedListMock).not.toHaveBeenCalled());
	});

	it("requests the feed once the flag is on", async () => {
		renderWithProviders(<FeedRoute />, { flags: { [FEED_FLAG]: true } });

		await waitFor(() => expect(feedListMock).toHaveBeenCalled());
	});
});
