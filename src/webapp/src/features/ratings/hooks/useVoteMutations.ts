import { useQueryClient } from "@tanstack/react-query";

import type { RatingRead, RatingVoteStrType } from "@/lib/api/generated";
import {
	useRatingsVotesDestroy,
	useRatingsVotesUpdate,
} from "@/lib/api/generated";

/**
 * Vote mutations with optimistic cache updates.
 *
 * Updates React Query cache directly to ensure votes persist across
 * filter/sort navigation without refetching.
 */

export function useCoursesRatingsVotesCreate() {
	const queryClient = useQueryClient();

	return useRatingsVotesUpdate({
		mutation: {
			onSuccess: (_data, variables) => {
				const { ratingId, data } = variables;
				const voteType = data.vote_type;

				// Update all cached rating queries to reflect the new vote
				queryClient.setQueriesData(
					{
						predicate: (query) => {
							const key = query.queryKey;
							return (
								Array.isArray(key) &&
								typeof key[0] === "string" &&
								key[0].includes("/ratings/")
							);
						},
					},
					(oldData: unknown) => {
						if (!oldData) return oldData;

						return updateRatingInCache(oldData, ratingId, voteType);
					},
				);
			},
		},
	});
}

export function useCoursesRatingsVotesDestroy() {
	const queryClient = useQueryClient();

	return useRatingsVotesDestroy({
		mutation: {
			onSuccess: (_data, variables) => {
				const { ratingId } = variables;

				// Update all cached rating queries to remove the vote
				queryClient.setQueriesData(
					{
						predicate: (query) => {
							const key = query.queryKey;
							return (
								Array.isArray(key) &&
								typeof key[0] === "string" &&
								key[0].includes("/ratings/")
							);
						},
					},
					(oldData: unknown) => {
						if (!oldData) return oldData;

						return updateRatingInCache(oldData, ratingId, null);
					},
				);
			},
		},
	});
}

/**
 * Update a rating's vote data within cached query results
 */
function updateRatingInCache(
	data: unknown,
	ratingId: string,
	newVote: RatingVoteStrType | null,
): unknown {
	if (!data) return data;

	// Type guard to check if data is an object
	if (typeof data !== "object") return data;

	const dataObj = data as Record<string, unknown>;

	// Handle paginated response structure
	if (
		"items" in dataObj &&
		dataObj.items &&
		typeof dataObj.items === "object"
	) {
		const items = dataObj.items as Record<string, unknown>;

		// Update in main ratings list
		if (Array.isArray(items.ratings)) {
			items.ratings = items.ratings.map((rating: RatingRead) =>
				updateRatingVote(rating, ratingId, newVote),
			);
		}

		// Update in user ratings list
		if (Array.isArray(items.user_ratings)) {
			items.user_ratings = items.user_ratings.map((rating: RatingRead) =>
				updateRatingVote(rating, ratingId, newVote),
			);
		}

		return { ...dataObj, items };
	}

	// Handle array of ratings
	if (Array.isArray(data)) {
		return data.map((rating: RatingRead) =>
			updateRatingVote(rating, ratingId, newVote),
		);
	}

	// Handle single rating
	if ("id" in dataObj && dataObj.id === ratingId) {
		return updateRatingVote(dataObj as RatingRead, ratingId, newVote);
	}

	return data;
}

/**
 * Update a single rating's vote and counts
 */
function updateRatingVote(
	rating: RatingRead,
	ratingId: string,
	newVote: RatingVoteStrType | null,
): RatingRead {
	if (rating.id !== ratingId) return rating;

	const oldVote = rating.viewer_vote;
	let upvotes = rating.upvotes ?? 0;
	let downvotes = rating.downvotes ?? 0;

	// Remove old vote counts
	if (oldVote === "UPVOTE") upvotes--;
	if (oldVote === "DOWNVOTE") downvotes--;

	// Add new vote counts
	if (newVote === "UPVOTE") upvotes++;
	if (newVote === "DOWNVOTE") downvotes++;

	return {
		...rating,
		viewer_vote: newVote,
		upvotes,
		downvotes,
	};
}
