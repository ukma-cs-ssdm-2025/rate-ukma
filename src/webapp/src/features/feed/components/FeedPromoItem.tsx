import { ArrowRight, Megaphone } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import type {
	FeedPromoAccent,
	FeedPromoItem as FeedPromoItemType,
} from "../feedTypes";

/**
 * Accent -> color treatment.
 */
/** Badge and Button share these variant names, so one value drives both. */
type AccentVariant = "default" | "secondary" | "destructive";

const ACCENT_STYLES: Record<
	FeedPromoAccent,
	{
		container: string;
		rail: string;
		variant: AccentVariant;
		/** Darkens the CTA where the variant's own fill is too pale to read as a button. */
		cta?: string;
	}
> = {
	BRAND: {
		container: "bg-primary/5 border-primary/20",
		rail: "bg-primary",
		variant: "default",
	},
	INFO: {
		container: "bg-accent border-border",
		rail: "bg-muted-foreground",
		variant: "secondary",
		cta: "bg-muted-foreground text-background hover:bg-muted-foreground/90",
	},
	WARNING: {
		container: "bg-destructive/5 border-destructive/20",
		rail: "bg-destructive",
		variant: "destructive",
	},
};

interface FeedPromoItemProps {
	readonly item: FeedPromoItemType;
	/** `banner` is wider/horizontal for top-of-page placement. */
	readonly variant?: "card" | "banner";
}

export function FeedPromoItem({ item, variant = "card" }: FeedPromoItemProps) {
	const accent = ACCENT_STYLES[item.accent ?? "BRAND"];
	const label = item.label ?? "Оголошення";
	const isBanner = variant === "banner";

	return (
		<article
			className={cn(
				"relative overflow-hidden rounded-xl border shadow-sm",
				accent.container,
				isBanner
					? "flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"
					: "flex h-full flex-col p-5",
			)}
		>
			<span
				className={cn("absolute inset-y-0 left-0 w-1", accent.rail)}
				aria-hidden
			/>

			<div className={cn("min-w-0", isBanner ? "flex-1 pl-2" : "pl-2")}>
				<div className="flex items-center gap-2">
					<Badge
						variant={accent.variant}
						className="gap-1 text-[10px] uppercase tracking-wide"
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
				<div
					className={cn(
						isBanner ? "shrink-0 pl-2 sm:pl-0" : "mt-auto pl-2 pt-4",
					)}
				>
					<Button
						asChild
						size="sm"
						variant={accent.variant}
						className={cn("gap-1.5", accent.cta)}
					>
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
