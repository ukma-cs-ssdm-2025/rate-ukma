import { ArrowRight, Megaphone } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { formatRelativeTime } from "@/features/notifications/notificationFormatting";
import { cn } from "@/lib/utils";
import type {
	AccentEnum,
	FeedPromoItem as FeedPromoItemData,
} from "@/lib/api/generated";
import { FeedCard } from "./FeedCard";
import type { FeedTone } from "./FeedCard";

interface AccentStyle {
	tone: FeedTone;
	button: "default" | "secondary" | "destructive";
	cta?: string;
}

const ACCENT: Record<AccentEnum, AccentStyle> = {
	BRAND: { tone: "primary", button: "default" },
	INFO: {
		tone: "muted",
		button: "secondary",
		cta: "bg-muted-foreground text-background hover:bg-muted-foreground/90",
	},
	WARNING: { tone: "destructive", button: "destructive" },
};

interface FeedPromoItemProps {
	readonly item: FeedPromoItemData;
	readonly variant?: "card" | "banner";
}

export function FeedPromoItem({
	item,
	variant = "card",
}: Readonly<FeedPromoItemProps>) {
	const known: AccentStyle | undefined = ACCENT[item.accent];
	const accent = known ?? ACCENT.BRAND;
	const kind = {
		label: item.label || "Оголошення",
		icon: Megaphone,
		tone: accent.tone,
	};
	const isBanner = variant === "banner";
	const cta = item.cta_label && item.cta_href && (
		<Button
			asChild
			size="sm"
			variant={accent.button}
			className={cn("gap-1.5", accent.cta)}
		>
			<a href={item.cta_href} target="_blank" rel="noopener noreferrer">
				{item.cta_label}
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
				avatarUrl={item.image_url}
				footer={
					<div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
						<time>{formatRelativeTime(item.occurred_at)}</time>
						{item.cta_label && item.cta_href ? (
							<a
								href={item.cta_href}
								target="_blank"
								rel="noopener noreferrer"
								className="inline-flex min-w-0 items-center gap-1 font-medium text-primary underline-offset-4 hover:underline"
							>
								<span className="truncate">{item.cta_label}</span>
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
			avatarUrl={item.image_url}
			footer={
				<div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 pt-1">
					<time className="text-xs text-muted-foreground">
						{formatRelativeTime(item.occurred_at)}
					</time>
					{cta}
				</div>
			}
		>
			<p className="text-sm leading-relaxed text-foreground/90">{item.body}</p>
		</FeedCard>
	);
}
