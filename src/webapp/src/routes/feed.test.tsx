import type { ReactNode } from "react";

import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as LayoutModule from "@/components/Layout";
import type { UseFeedReturn } from "@/features/feed/hooks/useFeed";
import * as useFeedModule from "@/features/feed/hooks/useFeed";
import { testIds } from "@/lib/test-ids";
import {
	createMockFeedPromoItem,
	createMockFeedReviewItem,
	createMockFeedState,
} from "@/test-utils/factories";
import { Providers, screen } from "@/test-utils/render";
import { renderWithRouter } from "@/test-utils/router";
import { FeedRoute } from "./feed";

let currentFeed: UseFeedReturn | null = null;

function setFeed(overrides?: Partial<UseFeedReturn>) {
	currentFeed = createMockFeedState({
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

// The route renders real `Link`s (empty state, review items), so it mounts in
// a real memory router instead of a module mock.
async function renderFeedRoute(feedEnabled: boolean) {
	await renderWithRouter(
		<Providers flags={{ fe_feed: feedEnabled }}>
			<FeedRoute />
		</Providers>,
	);
}

beforeEach(() => {
	vi.clearAllMocks();
	vi.spyOn(LayoutModule, "default").mockImplementation(
		({ children }: { children: ReactNode }) => <>{children}</>,
	);
	vi.spyOn(useFeedModule, "useFeed").mockImplementation(() => {
		if (currentFeed === null) {
			throw new Error("setFeed did not run before render");
		}
		return currentFeed;
	});
	setFeed();
});

describe("FeedRoute", () => {
	it("shows an unavailable message when the feed flag is off", async () => {
		await renderFeedRoute(false);

		expect(screen.getByText("Стрічка наразі недоступна.")).toBeInTheDocument();
	});

	it("renders the heading and feed items when the flag is on", async () => {
		await renderFeedRoute(true);

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
		setFeed({ items: [], isLoading: true });
		await renderFeedRoute(true);

		expect(screen.getByTestId(testIds.feed.skeleton)).toBeInTheDocument();
		expect(screen.queryByTestId(testIds.feed.list)).not.toBeInTheDocument();
		expect(
			screen.getByRole("heading", { name: /Стрічка оновлень/ }),
		).toBeInTheDocument();
	});

	it("shows the error state and retries on click", async () => {
		const refetch = vi.fn();
		setFeed({ items: [], isError: true, refetch });
		await renderFeedRoute(true);

		expect(screen.getByTestId(testIds.feed.errorState)).toBeInTheDocument();

		await userEvent.click(screen.getByTestId(testIds.feed.retryButton));

		expect(refetch).toHaveBeenCalledOnce();
	});

	it("disables the retry button while a retry is in flight", async () => {
		setFeed({ items: [], isError: true, isRefetching: true });
		await renderFeedRoute(true);

		expect(screen.getByTestId(testIds.feed.retryButton)).toBeDisabled();
	});

	it("shows the empty state when the feed has no items", async () => {
		setFeed({ items: [] });
		await renderFeedRoute(true);

		expect(screen.getByTestId(testIds.feed.emptyState)).toBeInTheDocument();
		expect(screen.queryByTestId(testIds.feed.list)).not.toBeInTheDocument();
	});

	it("prefers the skeleton over the empty state on the first load", async () => {
		setFeed({ items: [], isLoading: true });
		await renderFeedRoute(true);

		expect(screen.getByTestId(testIds.feed.skeleton)).toBeInTheDocument();
		expect(
			screen.queryByTestId(testIds.feed.emptyState),
		).not.toBeInTheDocument();
	});
});
