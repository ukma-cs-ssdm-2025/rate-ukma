import type { FeedItem } from "./feedTypes";
import type { UseFeedReturn } from "./hooks/useFeed";

/**
 * Shared fixtures for the components that render a feed.
 *
 * `FeedStrip` and the `/feed` route both need the same mocked `useFeed`, so
 * the items and the hook's return shape live here rather than being repeated
 * in each test file.
 */
export const PINNED_PROMO: FeedItem = {
	kind: "promo",
	id: "p1",
	createdAt: "2026-09-01T10:00:00.000Z",
	pinned: true,
	title: "Хакатон факультету інформатики",
	body: "48 годин, 12–14 вересня.",
};

export const UNPINNED_PROMO: FeedItem = {
	kind: "promo",
	id: "p2",
	createdAt: "2026-09-02T10:00:00.000Z",
	title: "Реєстрація на вибіркові відкрита",
	body: "До 20 вересня.",
};

export const REVIEW: FeedItem = {
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

export const FEED_ITEMS: FeedItem[] = [PINNED_PROMO, UNPINNED_PROMO, REVIEW];

export const feedState: UseFeedReturn = {
	items: FEED_ITEMS,
	hasMore: false,
	isLoading: false,
	isError: false,
	isFetchingNextPage: false,
	loaderRef: { current: null },
};
