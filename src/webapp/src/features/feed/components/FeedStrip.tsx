import { Link } from "@tanstack/react-router";
import { ArrowRight, Newspaper, Pin } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { useFeatureFlagState } from "@/lib/feature-flags";
import { FEED_FLAG } from "../feedFlags";
import { MOCK_FEED_ITEMS } from "../feedMockData";
import { isPromoItem, orderFeedItems } from "../feedTypes";
import { FeedPromoItem } from "./FeedPromoItem";
import { FeedReviewItem } from "./FeedReviewItem";

/**
 * Top "updates" strip.
 *
 * A full-width, horizontally scrolling row placed above the courses table.
 * Each item is a fixed-width card; promos keep their accent treatment inline
 * so ads and review activity flow through the same carousel.
 *
 * Older entries are reached via the trailing "view all" tile and the header
 * link (the `/feed` route) rather than by discovering the horizontal scroll,
 * which isn't obvious on its own.
 */
export function FeedStrip() {
	const { enabled, isReady } = useFeatureFlagState(FEED_FLAG);
	const items = MOCK_FEED_ITEMS;

	// Gate on the flag, and stay hidden until it resolves so the feed never
	// flashes in before a disabled flag lands.
	if (!isReady || !enabled) return null;

	return (
		<section aria-label="Стрічка оновлень" className="space-y-3">
			<div className="flex items-center justify-between gap-2">
				<div className="flex items-center gap-2">
					<Newspaper className="size-4 text-muted-foreground" />
					<h2 className="text-sm font-semibold">Стрічка оновлень</h2>
				</div>
				<Button
					asChild
					variant="ghost"
					size="sm"
					className="h-8 gap-1 text-muted-foreground hover:text-foreground"
				>
					<Link to="/feed">
						Уся стрічка
						<ArrowRight className="size-4" />
					</Link>
				</Button>
			</div>

			{/* Scrollbar hidden and snapping dropped so the row reads as a quiet
			    strip rather than an attention-grabbing carousel; the header link
			    and trailing tile carry discoverability of older items. */}
			<div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
				{orderFeedItems(items).map((item) => (
					<div
						key={item.id}
						className="relative w-[260px] shrink-0 sm:w-[280px]"
					>
						{item.pinned && (
							<span className="absolute right-2 top-2 z-10 inline-flex items-center gap-1 rounded-full border bg-background/90 px-2 py-0.5 text-[10px] font-medium text-muted-foreground shadow-sm backdrop-blur">
								<Pin className="size-3" />
							</span>
						)}
						{isPromoItem(item) ? (
							<FeedPromoItem item={item} />
						) : (
							<div className="h-full rounded-lg border bg-card/60 px-3">
								<FeedReviewItem item={item} />
							</div>
						)}
					</div>
				))}

				<Link
					to="/feed"
					aria-label="Переглянути всю стрічку"
					className="flex w-[140px] shrink-0 flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-3 text-center text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
				>
					<ArrowRight className="size-5" />
					Переглянути всі
				</Link>
			</div>
		</section>
	);
}
