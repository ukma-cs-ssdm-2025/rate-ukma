import { Link } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { formatRelativeTime } from "@/features/notifications/notificationFormatting";
import type { FeedCommentItem as FeedCommentItemType } from "../feedTypes";
import { FeedCard } from "./FeedCard";

interface FeedCommentItemProps {
	readonly item: FeedCommentItemType;
}

/** A comment left on a review; anonymous in the feed. */
export function FeedCommentItem({ item }: Readonly<FeedCommentItemProps>) {
	return (
		<FeedCard
			badge={
				<Badge variant="outline">
					<MessageCircle className="size-3" aria-hidden="true" />
					Коментар
				</Badge>
			}
			pinned={item.pinned}
			title={
				<Link
					to="/courses/$courseId"
					params={{ courseId: item.courseId }}
					className="transition-colors hover:text-primary hover:underline"
				>
					{item.courseTitle}
				</Link>
			}
			footer={
				<div className="text-xs text-muted-foreground">
					<time>{formatRelativeTime(item.createdAt)}</time>
				</div>
			}
		>
			<p className="line-clamp-2 text-sm text-muted-foreground">
				{item.content}
			</p>
		</FeedCard>
	);
}
