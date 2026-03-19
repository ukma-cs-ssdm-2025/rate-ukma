import { useCallback } from "react";

import { ArrowLeft, Bell, Check } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { testIds } from "@/lib/test-ids";
import { NotificationList } from "./NotificationList";
import {
	useMarkAllRead,
	useMarkGroupRead,
	useNotifications,
	useUnreadCount,
} from "../hooks/useNotifications";

interface MobileNotificationPanelProps {
	onBack: () => void;
	onNavigate: () => void;
}

export function MobileNotificationPanel({
	onBack,
	onNavigate,
}: Readonly<MobileNotificationPanelProps>) {
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
			markGroupRead(groupKey);
			onNavigate();
		},
		[markGroupRead, onNavigate],
	);

	const handleMarkAllRead = useCallback(() => {
		markAllRead();
		resetPagination();
	}, [markAllRead, resetPagination]);

	return (
		<div
			className="flex h-full flex-col"
			data-testid={testIds.notifications.mobilePanel}
		>
			<div className="flex items-center gap-2 border-b border-border/40 pb-3">
				<Button
					variant="ghost"
					size="icon"
					className="h-9 w-9 shrink-0 rounded-full"
					onClick={onBack}
					aria-label="Назад"
				>
					<ArrowLeft className="h-5 w-5" />
				</Button>
				<h3 className="flex-1 text-sm font-semibold">Сповіщення</h3>
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
			<div className="flex-1 overflow-y-auto">
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
		</div>
	);
}

interface MobileNotificationRowProps {
	onOpen: () => void;
}

export function MobileNotificationRow({
	onOpen,
}: Readonly<MobileNotificationRowProps>) {
	const { data } = useUnreadCount();
	const count = data?.count ?? 0;

	return (
		<div
			className="mb-3 flex items-center justify-between"
			data-testid={testIds.notifications.mobileRow}
		>
			<span className="text-sm text-muted-foreground">Сповіщення</span>
			<Button
				variant="ghost"
				size="icon"
				onClick={onOpen}
				className="relative h-9 w-9"
				aria-label="Відкрити сповіщення"
			>
				<Bell className="h-[1.2rem] w-[1.2rem]" />
				{count > 0 && (
					<span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
						{count > 99 ? "99+" : count}
					</span>
				)}
			</Button>
		</div>
	);
}
