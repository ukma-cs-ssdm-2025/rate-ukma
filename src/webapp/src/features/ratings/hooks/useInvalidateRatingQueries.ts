import { type Query, useQueryClient } from "@tanstack/react-query";

const RATINGS_PATH_FRAGMENT = "/ratings/";

/**
 * Invalidate all rating-related React Query queries.
 *
 * NOTE: Orval-generated query keys currently include the endpoint path as the
 * first element (e.g. ['/api/v1/courses/{courseId}/ratings/', params]).
 * Rating-related queries are matched and invalidated after vote mutations.
 */
export function useInvalidateRatingQueries() {
	const queryClient = useQueryClient();

	return () => {
		queryClient.invalidateQueries({
			predicate: (q: Query) => {
				const key = q.queryKey;
				if (!Array.isArray(key)) return false;

				const first = key[0];
				return (
					typeof first === "string" && first.includes(RATINGS_PATH_FRAGMENT)
				);
			},
		});
	};
}
