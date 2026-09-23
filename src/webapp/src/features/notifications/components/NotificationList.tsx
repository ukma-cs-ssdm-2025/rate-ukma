import { Link } from "@tanstack/react-router";
import { Bell } from "lucide-react";

import { Button } from "@/components/ui/Button";
import {
	Empty,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/Empty";
import { Spinner } from "@/components/ui/Spinner";
import type { NotificationGroup } from "@/lib/api/generated";
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

	return (
		<div className="flex flex-col gap-0.5">
			<ul
				className="flex flex-col gap-0.5"
				data-testid={testIds.notifications.list}
			>
				{notifications.map((notification) => (
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

function NotificationItem({
	notification,
	onClick,
}: Readonly<{
	notification: NotificationGroup;
	onClick?: (groupKey: string) => void;
}>) {
	const courseId = notification.course_id;

	const content = (
		<>
			<span
				aria-hidden
				className={cn(
					"mt-1.5 size-1.5 shrink-0 rounded-full",
					notification.is_unread ? "bg-primary" : "bg-transparent",
				)}
			/>
			<div className="flex min-w-0 flex-1 flex-col gap-0.5">
				<p className="line-clamp-2 text-sm leading-snug text-foreground">
					{notification.message}
				</p>
				{notification.latest_created_at && (
					<time className="text-xs text-muted-foreground">
						{formatRelativeTime(notification.latest_created_at)}
					</time>
				)}
			</div>
		</>
	);

	const itemClass =
		"flex items-start gap-2.5 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted";

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
