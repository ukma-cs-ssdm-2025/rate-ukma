import { useCallback, useState } from "react";
import { Link } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { formatRelativeTime } from "@/features/notifications/notificationFormatting";
import { truncateText } from "@/lib/markdown";
import { testIds } from "@/lib/test-ids";
import type { FeedCommentItem as FeedCommentItemType } from "../feedTypes";
import { FeedCard } from "./FeedCard";
import { FeedCommentDialog } from "./FeedCommentDialog";

interface FeedCommentItemProps {
	readonly item: FeedCommentItemType;
	readonly variant?: "card" | "banner";
}

/** A comment left on a review; anonymous in the feed. */
export function FeedCommentItem({
	item,
	variant = "card",
}: Readonly<FeedCommentItemProps>) {
	const [dialogOpen, setDialogOpen] = useState(false);
	const isBanner = variant === "banner";
	const { truncated, isTruncated } = truncateText(item.content, 300);

	const handleOpenDialog = useCallback(() => {
		setDialogOpen(true);
	}, []);

	return (
		<>
			<FeedCard
				variant={variant}
				kind={{ label: "Коментар", icon: MessageCircle, tone: "muted" }}
				pinned={item.pinned}
				title={
					<Link
						to="/courses/$courseId"
						params={{ courseId: item.courseId }}
						className="underline-offset-4 transition-colors hover:text-primary hover:underline"
					>
						{item.courseTitle}
					</Link>
				}
				footer={
					<div className="flex flex-col gap-2 text-xs text-muted-foreground">
						{isBanner && isTruncated && (
							<Button
								onClick={handleOpenDialog}
								variant="ghost"
								size="sm"
								className="h-auto w-fit p-0 text-xs font-medium text-primary"
								data-testid={testIds.feed.readMoreButton}
							>
								Читати більше
							</Button>
						)}
						<time className="truncate">
							{formatRelativeTime(item.createdAt)}
						</time>
					</div>
				}
			>
				{isBanner ? (
					<p className="line-clamp-4 text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
						{truncated}
					</p>
				) : (
					truncated
				)}
			</FeedCard>
			<FeedCommentDialog
				item={item}
				open={dialogOpen}
				onOpenChange={setDialogOpen}
			/>
		</>
	);
}
