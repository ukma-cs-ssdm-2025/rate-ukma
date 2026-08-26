import { ArrowRight, Newspaper } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { MOCK_FEED_ITEMS } from "../feedMockData";
import { isPromoItem } from "../feedTypes";
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
 * link (a future `/feed` route) rather than by discovering the horizontal
 * scroll, which isn't obvious on its own.
 */
export function FeedStrip() {
	const items = MOCK_FEED_ITEMS;

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
					<a href="#">
						Уся стрічка
						<ArrowRight className="size-4" />
					</a>
				</Button>
			</div>

			<div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2">
				{items.map((item) => (
					<div
						key={item.id}
						className="w-[280px] shrink-0 snap-start sm:w-[300px]"
					>
						{isPromoItem(item) ? (
							<FeedPromoItem item={item} />
						) : (
							<div className="h-full rounded-xl border bg-card px-3 shadow-sm">
								<FeedReviewItem item={item} />
							</div>
						)}
					</div>
				))}

				{/* Trailing tile makes it explicit that more (older) items exist
				    beyond the visible cards. */}
				<a
					href="#"
					aria-label="Переглянути всю стрічку"
					className="flex w-[160px] shrink-0 snap-start flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-card/50 px-3 text-center text-sm font-medium text-muted-foreground transition-colors hover:border-solid hover:text-foreground"
				>
					<ArrowRight className="size-5" />
					Переглянути всі
				</a>
			</div>
		</section>
	);
}
