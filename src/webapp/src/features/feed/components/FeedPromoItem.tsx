import { useCallback, useState } from "react";

import { ArrowRight, Megaphone, Pin } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { formatRelativeTime } from "@/features/notifications/notificationFormatting";
import { truncateText } from "@/lib/markdown";
import { testIds } from "@/lib/test-ids";
import { cn } from "@/lib/utils";
import type {
	FeedPromoAccent,
	FeedPromoItem as FeedPromoItemType,
} from "../feedTypes";
import { FeedCard, type FeedTone } from "./FeedCard";
import { FeedPostDialog } from "./FeedPostDialog";

interface AccentStyle {
	tone: FeedTone;
	button: "default" | "secondary" | "destructive";
	cta?: string;
}

const ACCENT: Record<FeedPromoAccent, AccentStyle> = {
	BRAND: { tone: "primary", button: "default" },
	// The secondary fill is too pale to read as a button on the tinted card.
	INFO: {
		tone: "muted",
		button: "secondary",
		cta: "bg-muted-foreground text-background hover:bg-muted-foreground/90",
	},
	WARNING: { tone: "destructive", button: "destructive" },
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
	const [dialogOpen, setDialogOpen] = useState(false);
	const accent = ACCENT[item.accent ?? "BRAND"] ?? ACCENT.BRAND;
	const kind = {
		label: item.label ?? "Оголошення",
		icon: Megaphone,
		tone: accent.tone,
	};
	const isBanner = variant === "banner";
	const { truncated, isTruncated } = truncateText(item.body, 300);

	const handleOpenDialog = useCallback(() => {
		setDialogOpen(true);
	}, []);

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
			<>
				<FeedCard
					variant="card"
					tinted
					kind={kind}
					pinned={item.pinned}
					title={item.title}
					footer={
						<div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
							{isTruncated && (
								<Button
									onClick={handleOpenDialog}
									variant="ghost"
									size="sm"
									className="h-auto p-0 text-xs font-medium text-primary"
									data-testid={testIds.feed.readMoreButton}
								>
									Читати більше
								</Button>
							)}
							<time>{formatRelativeTime(item.createdAt)}</time>
							{item.ctaLabel && item.ctaHref ? (
								<a
									href={item.ctaHref}
									target="_blank"
									rel="noopener noreferrer"
									className="inline-flex min-w-0 items-center gap-1 font-medium text-primary underline-offset-4 hover:underline ml-auto"
								>
									<span className="truncate">{item.ctaLabel}</span>
									<ArrowRight className="size-3.5 shrink-0" aria-hidden />
								</a>
							) : null}
						</div>
					}
				>
					<p className="line-clamp-2 whitespace-pre-wrap text-sm text-foreground/90">
						{truncated}
					</p>
				</FeedCard>
				<FeedPostDialog
					item={item}
					open={dialogOpen}
					onOpenChange={setDialogOpen}
				/>
			</>
		);
	}

	return (
		<>
			<article
				className={cn(
					"relative flex gap-3 overflow-hidden rounded-xl border p-4 text-card-foreground sm:gap-4 sm:p-5",
					accent.tone === "primary"
						? "border-primary/20 bg-primary/5"
						: accent.tone === "muted"
							? "bg-accent"
							: "border-destructive/20 bg-destructive/5",
					"sm:pl-6",
				)}
			>
				{accent.tone && (
					<span
						className={cn(
							"absolute inset-y-0 left-0 w-1",
							accent.tone === "primary"
								? "bg-primary"
								: accent.tone === "muted"
									? "bg-muted-foreground"
									: "bg-destructive",
						)}
						aria-hidden
					/>
				)}

				{/* Image */}
				{item.imageUrl && (
					<img
						src={item.imageUrl}
						alt={item.title}
						className="size-16 flex-shrink-0 rounded-lg object-cover sm:size-32"
						loading="lazy"
					/>
				)}

				{/* Content: Header + Title + Description + Footer */}
				<div className="flex flex-1 flex-col">
					{/* Header: Label + Pin */}
					<div className="flex items-center justify-between gap-2">
						<span className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground">
							<span
								className={cn(
									"flex size-6 items-center justify-center rounded-full",
									accent.tone === "primary"
										? "bg-primary/10 text-primary"
										: accent.tone === "muted"
											? "bg-muted text-muted-foreground"
											: "bg-destructive/10 text-destructive",
								)}
								aria-hidden
							>
								<Megaphone className="size-3.5" />
							</span>
							{item.label ?? "Оголошення"}
						</span>
						{item.pinned && (
							<span
								role="img"
								aria-label="Закріплено"
								className="inline-flex shrink-0 text-muted-foreground"
							>
								<Pin className="size-3.5" aria-hidden />
							</span>
						)}
					</div>

					{/* Title */}
					<button
						onClick={handleOpenDialog}
						className="mt-1 cursor-pointer text-left font-semibold leading-snug hover:opacity-75 transition-opacity"
						type="button"
					>
						{item.title}
					</button>

					<p className="mt-2 line-clamp-3 text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
						{truncated}
					</p>

					<div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 pt-2">
						{isTruncated && (
							<Button
								onClick={handleOpenDialog}
								variant="ghost"
								size="sm"
								className="h-auto p-0 text-xs font-medium text-primary"
								data-testid={testIds.feed.readMoreButton}
							>
								Читати більше
							</Button>
						)}
						<time className="text-xs text-muted-foreground">
							{formatRelativeTime(item.createdAt)}
						</time>
						{cta && <div className="ml-auto">{cta}</div>}
					</div>
				</div>
			</article>
			<FeedPostDialog
				item={item}
				open={dialogOpen}
				onOpenChange={setDialogOpen}
			/>
		</>
	);
}
