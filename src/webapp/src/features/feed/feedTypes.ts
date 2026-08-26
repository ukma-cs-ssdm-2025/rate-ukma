/**
 * The feed mixes two content sources that must stay visually distinguishable:
 *
 * - `review` — auto-populated activity, generated from real rating events.
 * - `promo`  — manually configured content (ads / announcements) authored in
 *              the admin panel.
 *
 * Both share `id` and `createdAt` so a single feed list can sort/interleave
 * them, but each renders through its own component.
 */
export type FeedItem = FeedReviewItem | FeedPromoItem;

export interface FeedReviewItem {
	readonly kind: "review";
	readonly id: string;
	readonly createdAt: string;
	readonly courseId: string;
	readonly courseTitle: string;
	readonly studentName: string;
	readonly isAnonymous: boolean;
	readonly avatarUrl?: string | null;
	readonly difficulty: number;
	readonly usefulness: number;
	readonly comment?: string | null;
	readonly semesterYear?: number;
	readonly semesterTerm?: string;
}

/**
 * Accent controls the promo card's color treatment so admins can visually
 * prioritise announcements without touching code.
 */
export type FeedPromoAccent = "brand" | "info" | "warning";

export interface FeedPromoItem {
	readonly kind: "promo";
	readonly id: string;
	readonly createdAt: string;
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
