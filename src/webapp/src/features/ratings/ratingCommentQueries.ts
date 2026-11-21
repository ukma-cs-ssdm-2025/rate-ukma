import type { useQueryClient } from "@tanstack/react-query";

import {
	getCommentsRepliesRetrieveQueryKey,
	getCoursesRatingsListQueryKey,
	getFeedListInfiniteQueryKey,
	getRatingsCommentsListQueryKey,
} from "@/lib/api/generated";

export const COMMENTS_PAGE_SIZE = 5;
export const REPLIES_PAGE_SIZE = 5;

export function invalidateRatingCommentQueries(
	queryClient: ReturnType<typeof useQueryClient>,
	ratingId: string,
	courseId?: string,
) {
	void queryClient.invalidateQueries({
		queryKey: getRatingsCommentsListQueryKey(ratingId),
	});
	void queryClient.invalidateQueries({
		queryKey: getFeedListInfiniteQueryKey(),
	});

	if (courseId) {
		void queryClient.invalidateQueries({
			queryKey: getCoursesRatingsListQueryKey(courseId),
			refetchType: "none",
		});
	}
}

export function invalidateRepliesQuery(
	queryClient: ReturnType<typeof useQueryClient>,
	commentId: string | null | undefined,
) {
	if (!commentId) {
		return;
	}

	void queryClient.invalidateQueries({
		queryKey: getCommentsRepliesRetrieveQueryKey(commentId),
	});
}
