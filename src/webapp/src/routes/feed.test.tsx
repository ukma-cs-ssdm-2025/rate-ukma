import type { ReactNode } from "react";

import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { UseFeedReturn } from "@/features/feed/hooks/useFeed";
import { createMockFeedState } from "@/test-utils/factories";
import { renderWithProviders, screen } from "@/test-utils/render";
import { testIds } from "@/lib/test-ids";
import { FeedRoute } from "./feed";

const { feedState } = vi.hoisted(() => ({
	feedState: { current: null as UseFeedReturn | null },
}));

vi.mock("@/features/feed/hooks/useFeed", () => ({
	useFeed: () => feedState.current,
}));

vi.mock("@/components/Layout", () => ({
	default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@tanstack/react-router", async () => ({
	...(await vi.importActual("@tanstack/react-router")),
	Link: (await import("@/test-utils/router")).MockLink,
}));

async function setFeed(overrides?: Partial<UseFeedReturn>) {
	const { createMockFeedPromoItem, createMockFeedReviewItem } =
		await import("@/test-utils/factories");
	feedState.current = createMockFeedState({
		items: [
			createMockFeedPromoItem({
				id: "p1",
				pinned: true,
				title: "Хакатон факультету інформатики",
				body: "48 годин, 12–14 вересня.",
			}),
			createMockFeedPromoItem({
				id: "p2",
				title: "Реєстрація на вибіркові відкрита",
				body: "До 20 вересня.",
			}),
			createMockFeedReviewItem({ id: "r1" }),
		],
		...overrides,
	});
}

beforeEach(async () => {
	await setFeed();
});

describe("FeedRoute", () => {
	it("shows an unavailable message when the feed flag is off", () => {
		renderWithProviders(<FeedRoute />, { flags: { fe_feed: false } });

		expect(screen.getByText("Стрічка наразі недоступна.")).toBeInTheDocument();
	});

	it("renders the heading and feed items when the flag is on", () => {
		renderWithProviders(<FeedRoute />, { flags: { fe_feed: true } });

		expect(
			screen.getByRole("heading", { name: /Стрічка оновлень/ }),
		).toBeInTheDocument();
		expect(
			screen.getByText("Хакатон факультету інформатики"),
		).toBeInTheDocument();
		expect(
			screen.queryByText("Стрічка наразі недоступна."),
		).not.toBeInTheDocument();
	});

	// The header stays mounted through every state, so each assertion below
	// also pins that the state replaces only the content beneath it.
	it("shows the skeleton while the first page loads", async () => {
		await setFeed({ items: [], isLoading: true });
		renderWithProviders(<FeedRoute />, { flags: { fe_feed: true } });

		expect(screen.getByTestId(testIds.feed.skeleton)).toBeInTheDocument();
		expect(screen.queryByTestId(testIds.feed.list)).not.toBeInTheDocument();
		expect(
			screen.getByRole("heading", { name: /Стрічка оновлень/ }),
		).toBeInTheDocument();
	});

	it("shows the error state and retries on click", async () => {
		const refetch = vi.fn();
		await setFeed({ items: [], isError: true, refetch });
		renderWithProviders(<FeedRoute />, { flags: { fe_feed: true } });

		expect(screen.getByTestId(testIds.feed.errorState)).toBeInTheDocument();

		await userEvent.click(screen.getByTestId(testIds.feed.retryButton));

		expect(refetch).toHaveBeenCalledOnce();
	});

	it("disables the retry button while a retry is in flight", async () => {
		await setFeed({ items: [], isError: true, isRefetching: true });
		renderWithProviders(<FeedRoute />, { flags: { fe_feed: true } });

		expect(screen.getByTestId(testIds.feed.retryButton)).toBeDisabled();
	});

	it("shows the empty state when the feed has no items", async () => {
		await setFeed({ items: [] });
		renderWithProviders(<FeedRoute />, { flags: { fe_feed: true } });

		expect(screen.getByTestId(testIds.feed.emptyState)).toBeInTheDocument();
		expect(screen.queryByTestId(testIds.feed.list)).not.toBeInTheDocument();
	});

	it("prefers the skeleton over the empty state on the first load", async () => {
		await setFeed({ items: [], isLoading: true });
		renderWithProviders(<FeedRoute />, { flags: { fe_feed: true } });

		expect(screen.getByTestId(testIds.feed.skeleton)).toBeInTheDocument();
		expect(
			screen.queryByTestId(testIds.feed.emptyState),
		).not.toBeInTheDocument();
	});
});
