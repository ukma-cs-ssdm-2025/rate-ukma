import type { ComponentProps } from "react";

import { ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatRelativeTime } from "@/features/notifications/notificationFormatting";
import type {
	FeedPromoAccent,
	FeedPromoItem as FeedPromoItemType,
} from "../feedTypes";
import { FeedCard } from "./FeedCard";

/** Accent only tints the badge; the card shell is shared. */
const ACCENT_BADGE = {
	BRAND: "soft",
	INFO: "secondary",
	WARNING: "soft-destructive",
} as const satisfies Record<
	FeedPromoAccent,
	ComponentProps<typeof Badge>["variant"]
>;

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
	const hasCta = Boolean(item.ctaLabel && item.ctaHref);

	// Compact strip tile: the CTA joins the single muted meta line as a
	// text link instead of a button block.
	if (!isBanner) {
		return (
			<FeedCard
				variant="card"
				badge={<Badge variant={accent}>{label}</Badge>}
				pinned={item.pinned}
				title={item.title}
				footer={
					<p className="truncate text-xs text-muted-foreground">
						<time>{formatRelativeTime(item.createdAt)}</time>
						{hasCta && (
							<>
								{", "}
								<a
									href={item.ctaHref}
									target="_blank"
									rel="noopener noreferrer"
									className="inline-flex items-center gap-0.5 font-medium text-primary hover:underline"
								>
									{item.ctaLabel}
									<ExternalLink className="size-3.5" aria-hidden />
								</a>
							</>
						)}
					</p>
				}
			>
				<p className="truncate text-sm text-muted-foreground">{item.body}</p>
			</FeedCard>
		);
	}

	return (
		<FeedCard
			variant="banner"
			badge={<Badge variant={accent}>{label}</Badge>}
			pinned={item.pinned}
			title={item.title}
			footer={
				/* A label without an href goes nowhere, so the CTA needs both halves. */
				hasCta && (
					<Button asChild size="sm" variant="outline" className="gap-1.5">
						<a href={item.ctaHref} target="_blank" rel="noopener noreferrer">
							{item.ctaLabel}
							<ExternalLink className="size-4" aria-hidden />
						</a>
					</Button>
				)
			}
		>
			{/* Banner only: the strip cards are too narrow to carry an image. */}
			{item.imageUrl && (
				<img
					src={item.imageUrl}
					alt={item.title}
					className="h-32 w-full rounded-lg object-cover"
					loading="lazy"
				/>
			)}
			<p className="text-sm text-muted-foreground">{item.body}</p>
		</FeedCard>
	);
}
