import { type ReactNode, useId } from "react";

import { Link } from "@tanstack/react-router";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useFeatureFlagState } from "@/lib/feature-flags";
import { useHorizontalScroll } from "@/lib/hooks/useHorizontalScroll";
import { cn } from "@/lib/utils";
import { useFeed } from "../hooks/useFeed";
import { FeedItem } from "./FeedItem";

const STRIP_PAGE_SIZE = 8;
const LOADING_TILES = ["tile-1", "tile-2", "tile-3", "tile-4", "tile-5"];

/** One tile's box in the strip, for tiles passed in from outside the feed. */
export const FEED_TILE_CLASS =
	"h-[84px] w-[250px] shrink-0 snap-start overflow-hidden";

type ScrollEdge = "both" | "left" | "right" | "none";

const EDGE_MASK: Record<ScrollEdge, string | undefined> = {
	both: "[mask-image:linear-gradient(to_right,transparent,black_24px,black_calc(100%_-_24px),transparent)]",
	left: "[mask-image:linear-gradient(to_right,transparent,black_24px)]",
	right:
		"[mask-image:linear-gradient(to_right,black_calc(100%_-_24px),transparent)]",
	none: undefined,
};

function scrollEdge(
	canScrollPrev: boolean,
	canScrollNext: boolean,
): ScrollEdge {
	if (canScrollPrev && canScrollNext) return "both";
	if (canScrollPrev) return "left";
	if (canScrollNext) return "right";
	return "none";
}

export function FeedStrip({
	lead,
}: Readonly<{
	/** A tile shown before the feed items, sized with `FEED_TILE_CLASS`. */
	lead?: ReactNode;
}>) {
	const { enabled, isReady } = useFeatureFlagState("fe_feed");
	const { items, isLoading } = useFeed({
		limit: STRIP_PAGE_SIZE,
		infinite: false,
		enabled: isReady && enabled,
	});
	const { ref, canScrollPrev, canScrollNext, scrollPrev, scrollNext } =
		useHorizontalScroll(items.length);
	const scrollId = useId();
	const edge = scrollEdge(canScrollPrev, canScrollNext);

	// Gate on the flag, and stay hidden until it resolves so the feed never
	// flashes in before a disabled flag lands.
	if (!isReady || !enabled) return null;

	// The strip is secondary to the courses table below it: an empty or failed
	// feed should leave no gap rather than announce itself.
	if (!isLoading && items.length === 0) return null;

	return (
		<section aria-label="Стрічка оновлень" className="space-y-2">
			<div className="flex items-center justify-between gap-2">
				<h2 className="text-sm font-semibold">Стрічка оновлень</h2>
				<div className="flex items-center gap-1">
					<Button
						variant="outline"
						size="icon-sm"
						className="hidden sm:inline-flex"
						aria-label="Попередні"
						aria-controls={scrollId}
						disabled={!canScrollPrev}
						onClick={scrollPrev}
					>
						<ChevronLeft className="size-4" />
					</Button>
					<Button
						variant="outline"
						size="icon-sm"
						className="hidden sm:inline-flex"
						aria-label="Наступні"
						aria-controls={scrollId}
						disabled={!canScrollNext}
						onClick={scrollNext}
					>
						<ChevronRight className="size-4" />
					</Button>
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
			</div>

			{/* relative: the tiles' sr-only labels are absolute; without a positioned
			    scroller they resolve against the page and widen it horizontally. */}
			<div
				ref={ref}
				id={scrollId}
				className={cn(
					"relative -mx-1 flex gap-3 overflow-x-auto overscroll-x-contain scroll-px-1 snap-x snap-mandatory px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
					EDGE_MASK[edge],
				)}
			>
				{isLoading
					? LOADING_TILES.map((key) => (
							<div
								key={key}
								aria-hidden="true"
								className="h-[84px] w-[250px] shrink-0 space-y-2 rounded-xl border bg-card p-3"
							>
								<Skeleton className="h-4 w-3/4" />
								<Skeleton className="h-3 w-full" />
								<Skeleton className="h-3 w-1/2" />
							</div>
						))
					: null}
				{items.length > 0 ? lead : null}
				{items.map((item) => (
					<div key={`${item.kind}:${item.id}`} className={FEED_TILE_CLASS}>
						<FeedItem item={item} />
					</div>
				))}

				{/* Rendered only with items: a lone tile becomes the snap target
				    while loading, and the browser keeps it in view once cards arrive. */}
				{items.length > 0 && (
					<Link
						to="/feed"
						aria-label="Переглянути всю стрічку"
						className="flex h-[84px] w-[120px] shrink-0 snap-start flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed px-3 text-center text-sm font-medium text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
					>
						<ArrowRight className="size-5" />
						Переглянути всі
					</Link>
				)}
			</div>
		</section>
	);
}
