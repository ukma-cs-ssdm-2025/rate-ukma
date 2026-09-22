import { useId } from "react";

import { Link } from "@tanstack/react-router";
import { ArrowRight, ChevronLeft, ChevronRight, Newspaper } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { useFeatureFlagState } from "@/lib/feature-flags";
import { useHorizontalScroll } from "@/lib/hooks/useHorizontalScroll";
import { cn } from "@/lib/utils";
import { useFeed } from "../hooks/useFeed";
import { FeedItem } from "./FeedItem";

/** Top "updates" strip: snap carousel with edge fades and paging arrows. */
const STRIP_PAGE_SIZE = 8;

type ScrollEdge = "both" | "left" | "right" | "none";

const EDGE_MASK: Record<ScrollEdge, string | undefined> = {
	both: "[mask-image:linear-gradient(to_right,transparent,black_24px,black_calc(100%_-_24px),transparent)]",
	left: "[mask-image:linear-gradient(to_right,transparent,black_24px)]",
	right:
		"[mask-image:linear-gradient(to_right,black_calc(100%_-_24px),transparent)]",
	none: undefined,
};

export function FeedStrip() {
	const { enabled, isReady } = useFeatureFlagState("fe_feed");
	const { items, isLoading } = useFeed({
		limit: STRIP_PAGE_SIZE,
		infinite: false,
		enabled: isReady && enabled,
	});
	const { ref, canScrollPrev, canScrollNext, scrollPrev, scrollNext } =
		useHorizontalScroll(items.length);
	const scrollId = useId();
	const edge: ScrollEdge = canScrollPrev
		? canScrollNext
			? "both"
			: "left"
		: canScrollNext
			? "right"
			: "none";

	// Gate on the flag, and stay hidden until it resolves so the feed never
	// flashes in before a disabled flag lands.
	if (!isReady || !enabled) return null;

	// The strip is secondary to the courses table below it: an empty or failed
	// feed should leave no gap rather than announce itself.
	if (!isLoading && items.length === 0) return null;

	return (
		<section aria-label="Стрічка оновлень" className="space-y-3">
			<div className="flex items-center justify-between gap-2">
				<div className="flex items-center gap-2">
					<Newspaper className="size-4 text-muted-foreground" />
					<h2 className="text-sm font-semibold">Стрічка оновлень</h2>
				</div>
				<div className="flex items-center gap-1">
					<Button
						variant="outline"
						size="icon-sm"
						className="hidden rounded-full sm:inline-flex"
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
						className="hidden rounded-full sm:inline-flex"
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

			<div
				ref={ref}
				id={scrollId}
				className={cn(
					"-mx-1 flex gap-3 overflow-x-auto overscroll-x-contain scroll-px-1 snap-x snap-mandatory px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
					EDGE_MASK[edge],
				)}
			>
				{items.map((item) => (
					<div
						key={`${item.kind}:${item.id}`}
						className="w-[260px] shrink-0 snap-start sm:w-[280px]"
					>
						<FeedItem item={item} />
					</div>
				))}

				<Link
					to="/feed"
					aria-label="Переглянути всю стрічку"
					className="flex w-[140px] shrink-0 snap-start flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-3 text-center text-sm font-medium text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
				>
					<ArrowRight className="size-5" />
					Переглянути всі
				</Link>
			</div>
		</section>
	);
}
