import { useCallback, useState } from "react";

import { ArrowLeft, Bell } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { testIds } from "@/lib/test-ids";
import { cn } from "@/lib/utils";
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
	const [isLeaving, setIsLeaving] = useState(false);

	// The menu swaps this panel out on back, so it slides away first and only
	// then hands control back; reduced motion skips straight to the swap.
	const handleBack = useCallback(() => {
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
			onBack();
			return;
		}
		setIsLeaving(true);
	}, [onBack]);

	const handleNotificationClick = useCallback(
		(groupKey: string) => {
			markGroupRead(groupKey);
			onNavigate();
		},
		[markGroupRead, onNavigate],
	);

	const handleMarkAllRead = useCallback(async () => {
		await markAllRead();
		resetPagination();
	}, [markAllRead, resetPagination]);

	return (
		<div
			className={cn(
				"flex h-full flex-col duration-200 motion-reduce:animate-none",
				isLeaving
					? "animate-out fade-out-0 slide-out-to-right-4 fill-mode-forwards"
					: "animate-in fade-in-0 slide-in-from-right-4",
			)}
			onAnimationEnd={(event) => {
				if (isLeaving && event.target === event.currentTarget) onBack();
			}}
			data-testid={testIds.notifications.mobilePanel}
		>
			<div className="flex items-center gap-1 px-1 py-2">
				<Button
					variant="ghost"
					size="icon"
					className="size-10 shrink-0"
					onClick={handleBack}
					aria-label="Назад"
				>
					<ArrowLeft className="size-5" />
				</Button>
				<h3 className="flex-1 text-sm font-semibold">Сповіщення</h3>
				{unreadCount > 0 && (
					<Button
						variant="ghost"
						size="sm"
						className="h-10 text-muted-foreground hover:text-foreground"
						onClick={handleMarkAllRead}
						disabled={isPending}
						data-testid={testIds.notifications.markReadButton}
					>
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
				className="relative size-9"
				aria-label="Відкрити сповіщення"
			>
				<Bell className="size-5" />
				{count > 0 && (
					<span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
						{count > 99 ? "99+" : count}
					</span>
				)}
			</Button>
		</div>
	);
}
