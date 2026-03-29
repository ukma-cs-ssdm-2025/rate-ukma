import { useCallback, useEffect, useState } from "react";

import { Bell, Check } from "lucide-react";

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

	// biome-ignore lint/correctness/useExhaustiveDependencies: refetch list only when unreadCount changes while popover is open
	useEffect(() => {
		if (open) {
			refetch();
		}
	}, [unreadCount]);

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
					<Bell className="h-[1.2rem] w-[1.2rem]" />
					{unreadCount > 0 && (
						<span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
							{unreadCount > 99 ? "99+" : unreadCount}
						</span>
					)}
				</Button>
			</PopoverTrigger>
			<PopoverContent
				align="end"
				className="w-80 p-0"
				data-testid={testIds.notifications.panel}
			>
				<div className="flex items-center justify-between border-b border-border/40 px-4 py-3">
					<h3 className="text-sm font-semibold">Сповіщення</h3>
					{unreadCount > 0 && (
						<Button
							variant="ghost"
							size="sm"
							className="h-auto px-2 py-1 text-xs"
							onClick={handleMarkAllRead}
							disabled={isPending}
							data-testid={testIds.notifications.markReadButton}
						>
							<Check className="mr-1 h-3 w-3" />
							Прочитати все
						</Button>
					)}
				</div>
				<div className="max-h-80 overflow-y-auto px-3">
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
