import { Link } from "@tanstack/react-router";
import { Bell, ThumbsDown, ThumbsUp } from "lucide-react";

import type { NotificationGroup } from "@/lib/api/generated";
import { testIds } from "@/lib/test-ids";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "../notificationFormatting";

interface NotificationListProps {
	notifications: NotificationGroup[];
	isLoading: boolean;
	onNotificationClick?: (groupKey: string) => void;
}

const EVENT_ICONS: Record<string, typeof ThumbsUp> = {
	RATING_UPVOTED: ThumbsUp,
	RATING_DOWNVOTED: ThumbsDown,
};

export function NotificationList({
	notifications,
	isLoading,
	onNotificationClick,
}: Readonly<NotificationListProps>) {
	if (isLoading) {
		return (
			<div
				className="flex items-center justify-center py-8"
				data-testid={testIds.notifications.loading}
			>
				<span className="text-sm text-muted-foreground">Завантаження...</span>
			</div>
		);
	}

	if (notifications.length === 0) {
		return (
			<div
				className="flex flex-col items-center justify-center gap-2 py-8"
				data-testid={testIds.notifications.empty}
			>
				<Bell className="h-8 w-8 text-muted-foreground/50" />
				<span className="text-sm text-muted-foreground">Немає сповіщень</span>
			</div>
		);
	}

	return (
		<ul className="flex flex-col" data-testid={testIds.notifications.list}>
			{notifications.map((notification) => (
				<NotificationItem
					key={notification.group_key}
					notification={notification}
					onClick={onNotificationClick}
				/>
			))}
		</ul>
	);
}

function NotificationItem({
	notification,
	onClick,
}: Readonly<{
	notification: NotificationGroup;
	onClick?: (groupKey: string) => void;
}>) {
	const Icon = EVENT_ICONS[notification.event_type ?? ""] ?? Bell;
	const isUpvote = notification.event_type === "RATING_UPVOTED";
	const courseId = notification.course_id;

	const content = (
		<>
			<div
				className={cn(
					"mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
					isUpvote
						? "bg-primary/10 text-primary"
						: "bg-destructive/10 text-destructive",
				)}
			>
				<Icon className="h-4 w-4" />
			</div>
			<div className="flex min-w-0 flex-1 flex-col gap-0.5">
				<p className="text-sm leading-snug">{notification.message}</p>
				{notification.latest_created_at && (
					<time className="text-xs text-muted-foreground">
						{formatRelativeTime(notification.latest_created_at)}
					</time>
				)}
			</div>
			{notification.is_unread && (
				<span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />
			)}
		</>
	);

	const itemClass = cn(
		"flex items-start gap-3 border-b border-border/40 px-1 py-3 last:border-b-0",
		notification.is_unread && "bg-accent/30",
		courseId &&
			"cursor-pointer rounded-md transition-colors hover:bg-accent/50",
	);

	if (courseId) {
		return (
			<li data-testid={testIds.notifications.item}>
				<Link
					to="/courses/$courseId"
					params={{ courseId }}
					className={itemClass}
					onClick={() => onClick?.(notification.group_key ?? "")}
				>
					{content}
				</Link>
			</li>
		);
	}

	return (
		<li className={itemClass} data-testid={testIds.notifications.item}>
			{content}
		</li>
	);
}
