import { Link } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";

import { formatRelativeTime } from "@/features/notifications/notificationFormatting";
import type { FeedCommentItem as FeedCommentItemType } from "../feedTypes";

interface FeedCommentItemProps {
	readonly item: FeedCommentItemType;
}

/**
 * Auto-populated feed entry: a comment someone left on a review.
 * Like reviews, comments are anonymous in the feed.
 */
export function FeedCommentItem({ item }: FeedCommentItemProps) {
	return (
		<article className="flex gap-3 py-4">
			<span
				className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
				aria-hidden
			>
				<MessageCircle className="size-4" />
			</span>
			<div className="min-w-0 flex-1">
				<p className="text-sm leading-snug">
					<span className="text-muted-foreground">
						Новий коментар до відгуку на{" "}
					</span>
					<Link
						to="/courses/$courseId"
						params={{ courseId: item.courseId }}
						className="font-medium text-foreground transition-colors hover:text-primary hover:underline"
					>
						{item.courseTitle}
					</Link>
				</p>

				<p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
					{item.content}
				</p>

				<div className="mt-2.5 text-xs text-muted-foreground">
					<time>{formatRelativeTime(item.createdAt)}</time>
				</div>
			</div>
		</article>
	);
}
