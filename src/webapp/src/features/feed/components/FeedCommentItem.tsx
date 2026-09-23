import { Link } from "@tanstack/react-router";

import { Badge } from "@/components/ui/Badge";
import { formatRelativeTime } from "@/features/notifications/notificationFormatting";
import type { FeedCommentItem as FeedCommentItemType } from "../feedTypes";
import { FeedCard } from "./FeedCard";

interface FeedCommentItemProps {
	readonly item: FeedCommentItemType;
	readonly variant?: "card" | "banner";
}

/** A comment left on a review; anonymous in the feed. */
export function FeedCommentItem({
	item,
	variant = "card",
}: Readonly<FeedCommentItemProps>) {
	const isBanner = variant === "banner";
	return (
		<FeedCard
			variant={variant}
			badge={<Badge variant="outline">Коментар</Badge>}
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
				<p className="text-xs text-muted-foreground">
					<time>{formatRelativeTime(item.createdAt)}</time>
				</p>
			}
		>
			<p
				className={
					isBanner
						? "line-clamp-2 text-sm text-muted-foreground"
						: "truncate text-sm text-muted-foreground"
				}
			>
				{item.content}
			</p>
		</FeedCard>
	);
}
