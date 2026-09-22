import { beforeEach, describe, expect, it, vi } from "vitest";

import * as feedHook from "@/features/feed/hooks/useFeed";
import {
	createMockFeedPromoItem,
	createMockFeedReviewItem,
	createMockFeedState,
} from "@/test-utils/factories";
import { Providers, screen } from "@/test-utils/render";
import { renderWithRouter } from "@/test-utils/router";
import { FeedStrip } from "./FeedStrip";

const feedState = createMockFeedState({
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
});

beforeEach(() => {
	vi.clearAllMocks();
	vi.spyOn(feedHook, "useFeed").mockReturnValue(feedState);
});

describe("FeedStrip", () => {
	it("renders nothing when the feed flag is off", async () => {
		await renderWithRouter(
			<Providers flags={{ fe_feed: false }}>
				<FeedStrip />
			</Providers>,
		);

		expect(screen.queryByText("Стрічка оновлень")).not.toBeInTheDocument();
	});

	it("renders nothing until the flags have resolved", async () => {
		await renderWithRouter(
			<Providers flags={{ fe_feed: true }} flagsReady={false}>
				<FeedStrip />
			</Providers>,
		);

		expect(screen.queryByText("Стрічка оновлень")).not.toBeInTheDocument();
	});

	it("renders the feed and links to /feed when the flag is on", async () => {
		await renderWithRouter(
			<Providers flags={{ fe_feed: true }}>
				<FeedStrip />
			</Providers>,
		);

		expect(screen.getByText("Стрічка оновлень")).toBeInTheDocument();
		expect(screen.getByRole("link", { name: /Уся стрічка/ })).toHaveAttribute(
			"href",
			"/feed",
		);
		expect(
			screen.getByRole("link", { name: /Переглянути всю стрічку/ }),
		).toHaveAttribute("href", "/feed");
	});

	it("orders pinned content ahead of unpinned content", async () => {
		await renderWithRouter(
			<Providers flags={{ fe_feed: true }}>
				<FeedStrip />
			</Providers>,
		);

		const pinned = screen.getByText("Хакатон факультету інформатики");
		const unpinned = screen.getByText("Реєстрація на вибіркові відкрита");

		// pinned promo (later by recency) should appear before the unpinned one.
		expect(
			pinned.compareDocumentPosition(unpinned) &
				Node.DOCUMENT_POSITION_FOLLOWING,
		).toBeTruthy();
	});
});
