import type { ReactNode } from "react";

import { describe, expect, it, vi } from "vitest";

import { FEED_FLAG } from "@/features/feed/feedFlags";
import { renderWithProviders, screen } from "@/test-utils/render";
import { FeedRoute } from "./feed";

import type { FeedItem } from "@/features/feed/feedTypes";

const PINNED_PROMO: FeedItem = {
	kind: "promo",
	id: "p1",
	createdAt: "2026-09-01T10:00:00.000Z",
	pinned: true,
	title: "Хакатон факультету інформатики",
	body: "48 годин, 12–14 вересня.",
};

const UNPINNED_PROMO: FeedItem = {
	kind: "promo",
	id: "p2",
	createdAt: "2026-09-02T10:00:00.000Z",
	title: "Реєстрація на вибіркові відкрита",
	body: "До 20 вересня.",
};

const REVIEW: FeedItem = {
	kind: "review",
	id: "r1",
	createdAt: "2026-09-03T10:00:00.000Z",
	courseId: "course-1",
	courseTitle: "Алгоритми та структури даних",
	difficulty: 4,
	usefulness: 5,
	comment: "Складно, але корисно.",
	courseAvgDifficulty: 4,
	courseAvgUsefulness: 5,
};

const FEED_ITEMS = [PINNED_PROMO, UNPINNED_PROMO, REVIEW];

const feedState = {
	items: FEED_ITEMS,
	hasMore: false,
	isLoading: false,
	isError: false,
	isFetchingNextPage: false,
	loaderRef: { current: null },
};

vi.mock("@/features/feed/hooks/useFeed", () => ({
	useFeed: () => feedState,
}));

vi.mock("@/components/Layout", () => ({
	default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@tanstack/react-router", async () => ({
	...(await vi.importActual("@tanstack/react-router")),
	Link: (await import("@/test-utils/router")).MockLink,
}));

describe("FeedRoute", () => {
	it("shows an unavailable message when the feed flag is off", () => {
		renderWithProviders(<FeedRoute />, { flags: { [FEED_FLAG]: false } });

		expect(screen.getByText("Стрічка наразі недоступна.")).toBeInTheDocument();
	});

	it("renders the heading and feed items when the flag is on", () => {
		renderWithProviders(<FeedRoute />, { flags: { [FEED_FLAG]: true } });

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
});
