import { Link } from "@tanstack/react-router";
import { Bell, MessageSquare, ThumbsDown, ThumbsUp } from "lucide-react";

import { Button } from "@/components/ui/Button";
import {
	Empty,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/Empty";
import { Spinner } from "@/components/ui/Spinner";
import { EventTypeEnum, type NotificationGroup } from "@/lib/api/generated";
import { testIds } from "@/lib/test-ids";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "../notificationFormatting";

interface NotificationListProps {
	notifications: NotificationGroup[];
	isLoading: boolean;
	isError?: boolean;
	onRetry?: () => void;
	isRetrying?: boolean;
	onNotificationClick?: (groupKey: string) => void;
	hasMore?: boolean;
	isLoadingMore?: boolean;
	onLoadMore?: () => void;
}

const EVENT_ICONS: Record<
	EventTypeEnum,
	{ icon: typeof ThumbsUp; tone: string }
> = {
	[EventTypeEnum.RATING_UPVOTED]: { icon: ThumbsUp, tone: "text-primary" },
	[EventTypeEnum.RATING_DOWNVOTED]: {
		icon: ThumbsDown,
		tone: "text-muted-foreground",
	},
	[EventTypeEnum.RATING_COMMENT_CREATED]: {
		icon: MessageSquare,
		tone: "text-foreground",
	},
};

const FALLBACK_EVENT = { icon: Bell, tone: "text-muted-foreground" };

export function NotificationList({
	notifications,
	isLoading,
	isError,
	onRetry,
	isRetrying,
	onNotificationClick,
	hasMore,
	isLoadingMore,
	onLoadMore,
}: Readonly<NotificationListProps>) {
	if (isLoading) {
		return (
			<div
				className="flex items-center justify-center gap-2 py-8"
				data-testid={testIds.notifications.loading}
			>
				<Spinner />
				<span className="text-sm text-muted-foreground">Завантаження...</span>
			</div>
		);
	}

	if (isError) {
		return (
			<div
				className="flex flex-col items-center justify-center gap-2 py-8"
				data-testid={testIds.notifications.error}
			>
				<span className="text-sm text-muted-foreground">
					Не вдалося завантажити
				</span>
				{onRetry && (
					<Button
						variant="ghost"
						size="sm"
						onClick={onRetry}
						disabled={isRetrying}
					>
						Спробувати знову
					</Button>
				)}
			</div>
		);
	}

	if (notifications.length === 0) {
		return (
			<Empty
				className="border-0 py-8"
				data-testid={testIds.notifications.empty}
			>
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<Bell />
					</EmptyMedia>
					<EmptyTitle className="text-sm">Немає сповіщень</EmptyTitle>
				</EmptyHeader>
			</Empty>
		);
	}

	const unread = notifications.filter((notification) => notification.is_unread);
	const read = notifications.filter((notification) => !notification.is_unread);
	const showGroups = unread.length > 0 && read.length > 0;

	return (
		<div className="flex flex-col gap-0.5">
			<ul
				className="flex flex-col gap-0.5"
				data-testid={testIds.notifications.list}
			>
				{showGroups && (
					<li className="px-3 pt-2 text-xs font-medium text-muted-foreground">
						Нові
					</li>
				)}
				{(showGroups ? unread : notifications).map((notification) => (
					<NotificationItem
						key={notification.group_key}
						notification={notification}
						onClick={onNotificationClick}
					/>
				))}
				{showGroups && (
					<li className="px-3 pt-2.5 text-xs font-medium text-muted-foreground">
						Раніше
					</li>
				)}
				{showGroups &&
					read.map((notification) => (
						<NotificationItem
							key={notification.group_key}
							notification={notification}
							onClick={onNotificationClick}
						/>
					))}
			</ul>
			{hasMore && (
				<Button
					variant="ghost"
					size="sm"
					className="mt-0.5 w-full text-muted-foreground"
					onClick={onLoadMore}
					disabled={isLoadingMore}
					data-testid={testIds.notifications.loadMore}
				>
					{isLoadingMore ? <Spinner className="mr-1" /> : null}
					Завантажити ще
				</Button>
			)}
		</div>
	);
}

// Comment notifications may carry the comment text as a trailing quoted
// segment of the message; split it off so the headline stays short.
function splitCommentQuote(message: string): {
	title: string;
	quote?: string;
} {
	const text = message.trimEnd();
	const open = text.search(/[«"“]/u);
	if (open < 0 || open > text.length - 3 || !/[»"”]$/u.test(text)) {
		return { title: message };
	}
	const title = text
		.slice(0, open)
		.trim()
		.replace(/[:—–-]$/u, "")
		.trimEnd();
	const quote = text.slice(open + 1, -1).trim();
	if (!title || !quote) {
		return { title: message };
	}
	return { title, quote };
}

function NotificationItem({
	notification,
	onClick,
}: Readonly<{
	notification: NotificationGroup;
	onClick?: (groupKey: string) => void;
}>) {
	const courseId = notification.course_id;
	const isUnread = notification.is_unread ?? false;
	const { icon: Icon, tone } =
		(notification.event_type && EVENT_ICONS[notification.event_type]) ||
		FALLBACK_EVENT;

	const { title, quote } =
		notification.event_type === EventTypeEnum.RATING_COMMENT_CREATED &&
		notification.message
			? splitCommentQuote(notification.message)
			: { title: notification.message };

	const content = (
		<>
			<Icon
				aria-hidden
				className={cn(
					"mt-0.5 size-4 shrink-0",
					isUnread ? tone : "text-muted-foreground",
				)}
			/>
			<div className="flex min-w-0 flex-1 flex-col gap-0.5">
				<p
					className={cn(
						"line-clamp-2 text-sm leading-snug break-words text-foreground",
						isUnread && "font-medium",
					)}
				>
					{title}
				</p>
				{quote && (
					<p className="line-clamp-2 text-sm break-words text-muted-foreground">
						{quote}
					</p>
				)}
				{notification.latest_created_at && (
					<time className="text-xs text-muted-foreground">
						{formatRelativeTime(notification.latest_created_at)}
					</time>
				)}
			</div>
		</>
	);

	const itemClass = cn(
		"flex items-start gap-2.5 rounded-lg px-3 py-2.5 transition-colors outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring",
		isUnread && "bg-primary/5",
	);

	if (courseId) {
		return (
			<li data-testid={testIds.notifications.item}>
				<Link
					to="/courses/$courseId"
					params={{ courseId }}
					className={itemClass}
					onClick={() => {
						if (notification.group_key) onClick?.(notification.group_key);
					}}
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
