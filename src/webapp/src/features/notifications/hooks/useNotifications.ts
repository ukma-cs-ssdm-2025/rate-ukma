import { useCallback, useEffect, useState } from "react";

import { useQueryClient } from "@tanstack/react-query";

import type { NotificationGroup } from "@/lib/api/generated";
import {
	getNotificationsListQueryKey,
	getNotificationsUnreadCountRetrieveQueryKey,
	notificationsList,
	useNotificationsList,
	useNotificationsMarkGroupReadCreate,
	useNotificationsMarkReadCreate,
	useNotificationsUnreadCountRetrieve,
} from "@/lib/api/generated";
import { useAuth } from "@/lib/auth";

const UNREAD_COUNT_POLL_INTERVAL = 30_000;
const PAGE_SIZE = 20;

export function useUnreadCount() {
	const { status } = useAuth();
	const isAuthenticated = status === "authenticated";

	return useNotificationsUnreadCountRetrieve({
		query: {
			enabled: isAuthenticated,
			refetchInterval: UNREAD_COUNT_POLL_INTERVAL,
			staleTime: UNREAD_COUNT_POLL_INTERVAL,
		},
	});
}

export function useNotifications() {
	const { data, isLoading, isError, refetch, isRefetching } =
		useNotificationsList({ limit: PAGE_SIZE, offset: 0 });
	const [extra, setExtra] = useState<NotificationGroup[]>([]);
	const [isLoadingMore, setIsLoadingMore] = useState(false);
	const [hasMore, setHasMore] = useState(true);

	const firstPage = data ?? [];

	// biome-ignore lint/correctness/useExhaustiveDependencies: reset buffer when server data changes
	useEffect(() => {
		setExtra([]);
		setHasMore(true);
	}, [data]);

	const notifications = [...firstPage, ...extra];

	const queryClient = useQueryClient();

	const loadMore = useCallback(async () => {
		if (isLoadingMore || !hasMore) return;
		setIsLoadingMore(true);
		try {
			const nextPage = await notificationsList({
				limit: PAGE_SIZE,
				offset: notifications.length,
			});
			if (nextPage.length < PAGE_SIZE) {
				setHasMore(false);
			}
			setExtra((prev) => [...prev, ...nextPage]);
		} finally {
			setIsLoadingMore(false);
		}
	}, [isLoadingMore, hasMore, notifications.length]);

	const resetPagination = useCallback(() => {
		setExtra([]);
		setHasMore(true);
		queryClient.invalidateQueries({
			queryKey: getNotificationsListQueryKey(),
		});
	}, [queryClient]);

	return {
		notifications,
		isLoading,
		isError,
		refetch,
		isRefetching,
		loadMore,
		isLoadingMore,
		hasMore: hasMore && firstPage.length >= PAGE_SIZE,
		resetPagination,
	};
}

export function useMarkAllRead() {
	const queryClient = useQueryClient();
	const { mutateAsync, isPending } = useNotificationsMarkReadCreate({
		mutation: {
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: getNotificationsUnreadCountRetrieveQueryKey(),
				});
				queryClient.invalidateQueries({
					queryKey: getNotificationsListQueryKey(),
				});
			},
		},
	});

	const markAllRead = useCallback(() => mutateAsync(), [mutateAsync]);

	return { markAllRead, isPending };
}

export function useMarkGroupRead() {
	const queryClient = useQueryClient();
	const { mutate } = useNotificationsMarkGroupReadCreate({
		mutation: {
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: getNotificationsUnreadCountRetrieveQueryKey(),
				});
				queryClient.invalidateQueries({
					queryKey: getNotificationsListQueryKey(),
				});
			},
		},
	});

	const markGroupRead = useCallback(
		(groupKey: string) => mutate({ data: { group_key: groupKey } }),
		[mutate],
	);

	return { markGroupRead };
}
