import { ArrowRight, Megaphone } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import type {
	FeedPromoAccent,
	FeedPromoItem as FeedPromoItemType,
} from "../feedTypes";
import { FeedCard } from "./FeedCard";

/** Accent only tints the badge; the card shell is shared. */
const ACCENT_BADGE: Record<
	FeedPromoAccent,
	{ variant: "outline" | "secondary"; className?: string }
> = {
	BRAND: {
		variant: "outline",
		className: "border-transparent bg-primary/10 text-primary",
	},
	INFO: { variant: "secondary" },
	WARNING: {
		variant: "outline",
		className: "border-transparent bg-destructive/10 text-destructive",
	},
};

interface FeedPromoItemProps {
	readonly item: FeedPromoItemType;
	/** `banner` is wider for top-of-page placement and may carry an image. */
	readonly variant?: "card" | "banner";
}

export function FeedPromoItem({
	item,
	variant = "card",
}: Readonly<FeedPromoItemProps>) {
	const accent = ACCENT_BADGE[item.accent ?? "BRAND"] ?? ACCENT_BADGE.BRAND;
	const label = item.label ?? "Оголошення";
	const isBanner = variant === "banner";

	return (
		<FeedCard
			badge={
				<Badge variant={accent.variant} className={accent.className}>
					<Megaphone className="size-3" aria-hidden="true" />
					{label}
				</Badge>
			}
			pinned={item.pinned}
			title={item.title}
			footer={
				/* A label without an href goes nowhere, so the CTA needs both halves. */
				item.ctaLabel &&
				item.ctaHref && (
					<Button asChild size="sm" variant="outline" className="gap-1.5">
						<a href={item.ctaHref} target="_blank" rel="noopener noreferrer">
							{item.ctaLabel}
							<ArrowRight className="size-4" aria-hidden="true" />
						</a>
					</Button>
				)
			}
		>
			{/* Banner only: the strip cards are too narrow to carry an image. */}
			{item.imageUrl && isBanner && (
				<img
					src={item.imageUrl}
					alt={item.title}
					className="h-32 w-full rounded-lg object-cover"
					loading="lazy"
				/>
			)}
			<p
				className={cn(
					"text-sm text-muted-foreground",
					!isBanner && "line-clamp-2",
				)}
			>
				{item.body}
			</p>
		</FeedCard>
	);
}
