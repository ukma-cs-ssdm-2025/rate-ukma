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
				// Invalidate and refetch all rating list queries
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
				// Invalidate and refetch all rating list queries
				// This ensures pagination queries fetch fresh data from backend
				queryClient.invalidateQueries({
					predicate: (query) => {
						const queryKey = query.queryKey;
						return (
							Array.isArray(queryKey) &&
							typeof queryKey[0] === "string" &&
							queryKey[0].includes("/ratings/")
						);
					},
				});
			},
		},
	});
}
