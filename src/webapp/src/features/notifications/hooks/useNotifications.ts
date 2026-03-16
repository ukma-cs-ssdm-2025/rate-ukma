import { useCallback } from "react";

import { useQueryClient } from "@tanstack/react-query";

import {
	getNotificationsListQueryKey,
	getNotificationsUnreadCountRetrieveQueryKey,
	useNotificationsList,
	useNotificationsMarkGroupReadCreate,
	useNotificationsMarkReadCreate,
	useNotificationsUnreadCountRetrieve,
} from "@/lib/api/generated";
import { useAuth } from "@/lib/auth";

const UNREAD_COUNT_POLL_INTERVAL = 30_000;

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
	const { data, isLoading } = useNotificationsList();
	return { notifications: data ?? [], isLoading };
}

export function useMarkAllRead() {
	const queryClient = useQueryClient();
	const { mutate, isPending } = useNotificationsMarkReadCreate({
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

	const markAllRead = useCallback(() => mutate(), [mutate]);

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
