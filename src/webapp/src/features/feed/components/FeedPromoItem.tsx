import { ArrowRight, Megaphone } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import type {
	FeedPromoAccent,
	FeedPromoItem as FeedPromoItemType,
} from "../feedTypes";

/**
 * Accent -> color treatment. Manual content is deliberately louder than the
 * review stream: tinted background, colored left rail, and an explicit label
 * badge so it never gets mistaken for organic activity.
 */
const ACCENT_STYLES: Record<
	FeedPromoAccent,
	{ container: string; rail: string; badge: string }
> = {
	brand: {
		container: "bg-primary/5 border-primary/20",
		rail: "bg-primary",
		badge: "bg-primary text-primary-foreground",
	},
	info: {
		container:
			"bg-blue-50 border-blue-200 dark:bg-blue-950/40 dark:border-blue-900",
		rail: "bg-blue-500",
		badge: "bg-blue-500 text-white",
	},
	warning: {
		container:
			"bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:border-amber-900",
		rail: "bg-amber-500",
		badge: "bg-amber-500 text-white",
	},
};

interface FeedPromoItemProps {
	readonly item: FeedPromoItemType;
	/** `banner` is wider/horizontal for top-of-page placement. */
	readonly variant?: "card" | "banner";
}

export function FeedPromoItem({ item, variant = "card" }: FeedPromoItemProps) {
	const accent = ACCENT_STYLES[item.accent ?? "brand"];
	const label = item.label ?? "Оголошення";
	const isBanner = variant === "banner";

	return (
		<article
			className={cn(
				"relative overflow-hidden rounded-xl border shadow-sm",
				accent.container,
				isBanner
					? "flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"
					: "p-5",
			)}
		>
			<span
				className={cn("absolute inset-y-0 left-0 w-1", accent.rail)}
				aria-hidden
			/>

			<div className={cn("min-w-0", isBanner ? "flex-1 pl-2" : "pl-2")}>
				<div className="flex items-center gap-2">
					<Badge
						className={cn(
							"gap-1 border-transparent text-[10px] uppercase tracking-wide",
							accent.badge,
						)}
					>
						<Megaphone className="size-3" />
						{label}
					</Badge>
				</div>

				<h3 className="mt-3 font-semibold leading-tight tracking-tight">
					{item.title}
				</h3>
				<p
					className={cn(
						"mt-2 text-sm text-muted-foreground",
						isBanner ? "" : "line-clamp-2",
					)}
				>
					{item.body}
				</p>
			</div>

			{item.ctaLabel && (
				<div className={cn(isBanner ? "shrink-0 pl-2 sm:pl-0" : "mt-4 pl-2")}>
					<Button asChild size="sm" className="gap-1.5">
						<a href={item.ctaHref ?? "#"}>
							{item.ctaLabel}
							<ArrowRight className="size-4" />
						</a>
					</Button>
				</div>
			)}
		</article>
	);
}
