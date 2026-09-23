import { useCallback, useEffect, useState } from "react";

import { Bell } from "lucide-react";

import { Button } from "@/components/ui/Button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/Popover";
import { testIds } from "@/lib/test-ids";
import { NotificationList } from "./NotificationList";
import {
	useMarkAllRead,
	useMarkGroupRead,
	useNotifications,
	useUnreadCount,
} from "../hooks/useNotifications";

export function NotificationBell() {
	const [open, setOpen] = useState(false);
	const { data: unreadData } = useUnreadCount();
	const {
		notifications,
		isLoading,
		isError,
		refetch,
		isRefetching,
		loadMore,
		isLoadingMore,
		hasMore,
		resetPagination,
	} = useNotifications();
	const { markAllRead, isPending } = useMarkAllRead();
	const { markGroupRead } = useMarkGroupRead();

	const unreadCount = unreadData?.count ?? 0;

	const handleNotificationClick = useCallback(
		(groupKey: string) => {
			setOpen(false);
			markGroupRead(groupKey);
		},
		[markGroupRead],
	);

	const handleMarkAllRead = useCallback(async () => {
		await markAllRead();
		resetPagination();
	}, [markAllRead, resetPagination]);

	// refetch on open or when unreadCount changes while open
	useEffect(() => {
		if (open) {
			refetch();
		}
	}, [open, unreadCount]);

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					variant="ghost"
					size="icon"
					className="relative"
					aria-label={`Сповіщення${unreadCount > 0 ? ` (${unreadCount} непрочитаних)` : ""}`}
					data-testid={testIds.notifications.bellTrigger}
				>
					<Bell className="size-5" />
					{unreadCount > 0 && (
						<span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
							{unreadCount > 99 ? "99+" : unreadCount}
						</span>
					)}
				</Button>
			</PopoverTrigger>
			<PopoverContent
				align="end"
				className="w-80 p-1"
				data-testid={testIds.notifications.panel}
			>
				<div className="flex items-center justify-between py-1 pr-1 pl-3">
					<h3 className="text-sm font-semibold">Сповіщення</h3>
					{unreadCount > 0 && (
						<Button
							variant="ghost"
							size="sm"
							onClick={handleMarkAllRead}
							disabled={isPending}
							data-testid={testIds.notifications.markReadButton}
						>
							Прочитати все
						</Button>
					)}
				</div>
				<div className="max-h-80 overflow-y-auto">
					<NotificationList
						notifications={notifications}
						isLoading={isLoading}
						isError={isError}
						onRetry={() => refetch()}
						isRetrying={isRefetching}
						onNotificationClick={handleNotificationClick}
						hasMore={hasMore}
						isLoadingMore={isLoadingMore}
						onLoadMore={loadMore}
					/>
				</div>
			</PopoverContent>
		</Popover>
	);
}
