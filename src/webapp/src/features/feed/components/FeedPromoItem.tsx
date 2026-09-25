import { ExternalLink, Megaphone } from "lucide-react";

import { formatRelativeTime } from "@/features/notifications/notificationFormatting";
import type {
	FeedPromoAccent,
	FeedPromoItem as FeedPromoItemType,
} from "../feedTypes";
import { FeedCard, type FeedTone } from "./FeedCard";

/** Accent only picks the kind colour; the card shell is shared. */
const ACCENT_TONE = {
	BRAND: "primary",
	INFO: "muted",
	WARNING: "destructive",
} as const satisfies Record<FeedPromoAccent, FeedTone>;

interface FeedPromoItemProps {
	readonly item: FeedPromoItemType;
	/** `banner` is wider for top-of-page placement and may carry an image. */
	readonly variant?: "card" | "banner";
}

export function FeedPromoItem({
	item,
	variant = "card",
}: Readonly<FeedPromoItemProps>) {
	const kind = {
		label: item.label ?? "Оголошення",
		icon: Megaphone,
		tone: ACCENT_TONE[item.accent ?? "BRAND"] ?? ACCENT_TONE.BRAND,
	};
	const isBanner = variant === "banner";
	const hasCta = Boolean(item.ctaLabel && item.ctaHref);

	// Compact strip tile: the CTA joins the single muted meta line as a
	// text link instead of a button block.
	if (!isBanner) {
		return (
			<FeedCard
				variant="card"
				kind={kind}
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
									className="inline-flex items-center gap-0.5 font-medium text-primary underline-offset-4 hover:underline"
								>
									{item.ctaLabel}
									<ExternalLink className="size-3.5" aria-hidden />
								</a>
							</>
						)}
					</p>
				}
			>
				<p className="line-clamp-2 text-sm text-muted-foreground">
					{item.body}
				</p>
			</FeedCard>
		);
	}

	return (
		<FeedCard
			variant="banner"
			kind={kind}
			pinned={item.pinned}
			title={item.title}
			footer={
				<div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
					<time>{formatRelativeTime(item.createdAt)}</time>
					{/* A label without an href goes nowhere, so the CTA needs both halves. */}
					{hasCta && (
						<a
							href={item.ctaHref}
							target="_blank"
							rel="noopener noreferrer"
							className="ml-auto inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
						>
							{item.ctaLabel}
							<ExternalLink className="size-3.5" aria-hidden />
						</a>
					)}
				</div>
			}
		>
			{/* Banner only: the strip cards are too narrow to carry an image. */}
			{item.imageUrl && (
				<img
					src={item.imageUrl}
					alt={item.title}
					className="aspect-[3/1] w-full rounded-lg bg-muted object-cover"
					loading="lazy"
				/>
			)}
			<p className="text-sm leading-relaxed text-foreground/90">{item.body}</p>
		</FeedCard>
	);
}
