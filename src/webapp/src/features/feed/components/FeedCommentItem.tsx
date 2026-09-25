import { Link } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";

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
			kind={{ label: "Коментар", icon: MessageCircle, tone: "success" }}
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
				<div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
					<time className="truncate">{formatRelativeTime(item.createdAt)}</time>
				</div>
			}
		>
			<p
				className={
					isBanner
						? "line-clamp-4 text-sm leading-relaxed whitespace-pre-wrap text-foreground/90"
						: "line-clamp-2 text-sm text-muted-foreground"
				}
			>
				{item.content}
			</p>
		</FeedCard>
	);
}
