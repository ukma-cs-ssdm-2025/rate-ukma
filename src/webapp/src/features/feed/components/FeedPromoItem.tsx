import { ArrowRight, Megaphone } from "lucide-react";

import { Button } from "@/components/ui/Button";

import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/features/notifications/notificationFormatting";
import type {
	FeedPromoAccent,
	FeedPromoItem as FeedPromoItemType,
} from "../feedTypes";
import { FeedCard, type FeedTone } from "./FeedCard";

/** Badge and Button share these variant names, so one value drives both. */
const ACCENT = {
	BRAND: { tone: "primary", button: "default" },
	// The secondary fill is too pale to read as a button on the tinted card.
	INFO: {
		tone: "muted",
		button: "secondary",
		cta: "bg-muted-foreground text-background hover:bg-muted-foreground/90",
	},
	WARNING: { tone: "destructive", button: "destructive" },
} as const satisfies Record<
	FeedPromoAccent,
	{
		tone: FeedTone;
		button: "default" | "secondary" | "destructive";
		cta?: string;
	}
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
	const accent: {
		tone: FeedTone;
		button: "default" | "secondary" | "destructive";
		cta?: string;
	} = ACCENT[item.accent ?? "BRAND"] ?? ACCENT.BRAND;
	const kind = {
		label: item.label ?? "Оголошення",
		icon: Megaphone,
		tone: accent.tone,
	};
	const isBanner = variant === "banner";
	// A label without an href goes nowhere, so the CTA needs both halves.
	const cta = item.ctaLabel && item.ctaHref && (
		<Button
			asChild
			size="sm"
			variant={accent.button}
			className={cn("gap-1.5", accent.cta)}
		>
			<a href={item.ctaHref} target="_blank" rel="noopener noreferrer">
				{item.ctaLabel}
				<ArrowRight className="size-4" aria-hidden />
			</a>
		</Button>
	);

	if (!isBanner) {
		return (
			<FeedCard
				variant="card"
				tinted
				kind={kind}
				pinned={item.pinned}
				title={item.title}
				footer={
					<div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
						<time>{formatRelativeTime(item.createdAt)}</time>
						{item.ctaLabel && item.ctaHref ? (
							<a
								href={item.ctaHref}
								target="_blank"
								rel="noopener noreferrer"
								className="inline-flex min-w-0 items-center gap-1 font-medium text-primary underline-offset-4 hover:underline"
							>
								<span className="truncate">{item.ctaLabel}</span>
								<ArrowRight className="size-3.5 shrink-0" aria-hidden />
							</a>
						) : null}
					</div>
				}
			>
				{item.body}
			</FeedCard>
		);
	}

	return (
		<FeedCard
			variant="banner"
			tinted
			kind={kind}
			pinned={item.pinned}
			title={item.title}
			footer={
				<div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 pt-1">
					<time className="text-xs text-muted-foreground">
						{formatRelativeTime(item.createdAt)}
					</time>
					{cta}
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
