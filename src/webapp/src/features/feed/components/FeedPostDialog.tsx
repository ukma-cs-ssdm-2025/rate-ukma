import { ArrowRight, Megaphone } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/Dialog";
import { Markdown } from "@/components/ui/Markdown";
import { cn } from "@/lib/utils";
import { testIds } from "@/lib/test-ids";
import type { FeedPromoItem } from "../feedTypes";
import { DEFAULT_PROMO_LABEL, getAccentStyles } from "./promoAccent";

interface FeedPostDialogProps {
	readonly item: FeedPromoItem;
	readonly open: boolean;
	readonly onOpenChange: (open: boolean) => void;
}

/** Full-size view of a long-form post, opened from the clamped feed card. */
export function FeedPostDialog({
	item,
	open,
	onOpenChange,
}: FeedPostDialogProps) {
	const accent = getAccentStyles(item.accent);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				className="max-h-[85vh] overflow-y-auto sm:max-w-2xl"
				data-testid={testIds.feed.postDialog}
			>
				<DialogHeader>
					<div className="flex items-center gap-3">
						{item.imageUrl && (
							<img
								src={item.imageUrl}
								alt={item.title}
								className="size-16 flex-shrink-0 rounded-lg object-cover"
								loading="lazy"
							/>
						)}
						<div className="flex-1">
							<Badge
								variant={accent.variant}
								className="gap-1 text-[10px] uppercase tracking-wide"
							>
								<Megaphone className="size-3" />
								{item.label ?? DEFAULT_PROMO_LABEL}
							</Badge>
							<DialogTitle className="mt-2 leading-tight tracking-tight">
								{item.title}
							</DialogTitle>
						</div>
					</div>
				</DialogHeader>

				{/* asChild: the description must be a single element, and Markdown
				    emits block children a <p> could not legally contain. */}
				<DialogDescription asChild>
					<Markdown className="text-sm leading-relaxed text-foreground/90">
						{item.body}
					</Markdown>
				</DialogDescription>

				{item.ctaLabel && item.ctaHref && (
					<div>
						<Button
							asChild
							size="sm"
							variant={accent.variant}
							className={cn("gap-1.5", accent.cta)}
						>
							<a href={item.ctaHref} target="_blank" rel="noopener noreferrer">
								{item.ctaLabel}
								<ArrowRight className="size-4" />
							</a>
						</Button>
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}
