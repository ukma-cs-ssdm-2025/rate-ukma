import { Link } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";

import { formatRelativeTime } from "@/features/notifications/notificationFormatting";
import type { FeedCommentItem as FeedCommentItemData } from "@/lib/api/generated";
import { FeedCard } from "./FeedCard";

interface FeedCommentItemProps {
	readonly item: FeedCommentItemData;
	readonly variant?: "card" | "banner";
}

export function FeedCommentItem({
	item,
	variant = "card",
}: Readonly<FeedCommentItemProps>) {
	const isBanner = variant === "banner";
	return (
		<FeedCard
			variant={variant}
			kind={{ label: "Коментар", icon: MessageCircle, tone: "muted" }}
			title={
				<Link
					to="/courses/$courseId"
					params={{ courseId: item.course_id }}
					className="underline-offset-4 transition-colors hover:text-primary hover:underline"
				>
					{item.course_title}
				</Link>
			}
			footer={
				<div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
					<time className="truncate">
						{formatRelativeTime(item.occurred_at)}
					</time>
				</div>
			}
		>
			{isBanner ? (
				<p className="line-clamp-4 text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
					{item.content}
				</p>
			) : (
				item.content
			)}
		</FeedCard>
	);
}
