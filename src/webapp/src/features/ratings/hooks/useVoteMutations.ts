import { useQueryClient } from "@tanstack/react-query";

import {
	useRatingsVotesDestroy,
	useRatingsVotesUpdate,
} from "@/lib/api/generated";

export function useCoursesRatingsVotesCreate() {
	const queryClient = useQueryClient();

	return useRatingsVotesUpdate({
		mutation: {
			onSuccess: (_data) => {
				// Mark all rating list queries as stale without refetching
				// They will fetch fresh data when user changes filters
				queryClient.invalidateQueries({
					predicate: (query) => {
						const queryKey = query.queryKey;
						// Query key format: ['/api/v1/courses/{courseId}/ratings/', params]
						return (
							Array.isArray(queryKey) &&
							typeof queryKey[0] === "string" &&
							queryKey[0].includes("/ratings/")
						);
					},
					refetchType: "none", // Don't refetch, just mark as stale
				});
			},
		},
	});
}

export function useCoursesRatingsVotesDestroy() {
	const queryClient = useQueryClient();

	return useRatingsVotesDestroy({
		mutation: {
			onSuccess: () => {
				// Mark all rating list queries as stale without refetching
				queryClient.invalidateQueries({
					predicate: (query) => {
						const queryKey = query.queryKey;
						return (
							Array.isArray(queryKey) &&
							typeof queryKey[0] === "string" &&
							queryKey[0].includes("/ratings/")
						);
					},
					refetchType: "none", // Don't refetch, just mark as stale
				});
			},
		},
	});
}
