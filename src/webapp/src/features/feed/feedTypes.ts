/**
 * The feed mixes two content sources that must stay visually distinguishable:
 *
 * - `review` — auto-populated activity, generated from real rating events.
 * - `promo`  — manually configured content (ads / announcements) authored in
 *              the admin panel.
 *
 * Both share `id` and `createdAt` so a single feed list can sort/interleave
 * them, but each renders through its own component.
 *
 * `pinned` is the orthogonal "static vs dynamic" axis the admin controls:
 * pinned items ("static content") lead the feed and hold their place; the rest
 * ("dynamic content") flow after in recency order. Any item kind can be pinned.
 */
export type FeedItem = FeedReviewItem | FeedPromoItem;

export interface FeedReviewItem {
	readonly kind: "review";
	readonly id: string;
	readonly createdAt: string;
	readonly pinned?: boolean;
	readonly courseId: string;
	readonly courseTitle: string;
	readonly difficulty: number;
	readonly usefulness: number;
	readonly comment: string;
	readonly courseAvgDifficulty: number;
	readonly courseAvgUsefulness: number;
	readonly semesterYear?: number;
	readonly semesterTerm?: string;
}

/**
 * Accent controls the promo card's color treatment so admins can visually
 * prioritise announcements without touching code.
 */
export type FeedPromoAccent = "BRAND" | "INFO" | "WARNING";

export interface FeedPromoItem {
	readonly kind: "promo";
	readonly id: string;
	readonly createdAt: string;
	readonly pinned?: boolean;
	readonly title: string;
	readonly body: string;
	readonly label?: string;
	readonly ctaLabel?: string;
	readonly ctaHref?: string;
	readonly imageUrl?: string | null;
	readonly accent?: FeedPromoAccent;
}

export function isPromoItem(item: FeedItem): item is FeedPromoItem {
	return item.kind === "promo";
}

/**
 * Pinned ("static") items first, in their given order, then the rest
 * ("dynamic") unchanged. Stable, so items keep their relative order within
 * each group.
 */
export function orderFeedItems(items: readonly FeedItem[]): FeedItem[] {
	return [...items].sort(
		(a, b) => Number(b.pinned ?? false) - Number(a.pinned ?? false),
	);
}
