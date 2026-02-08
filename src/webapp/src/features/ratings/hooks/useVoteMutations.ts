import {
	useRatingsVotesDestroy,
	useRatingsVotesUpdate,
} from "@/lib/api/generated";
import { useInvalidateRatingQueries } from "./useInvalidateRatingQueries";

export function useCoursesRatingsVotesCreate() {
	const invalidateRatingQueries = useInvalidateRatingQueries();

	return useRatingsVotesUpdate({
		mutation: {
			onSuccess: () => {
				invalidateRatingQueries();
			},
		},
	});
}

export function useCoursesRatingsVotesDestroy() {
	const invalidateRatingQueries = useInvalidateRatingQueries();

	return useRatingsVotesDestroy({
		mutation: {
			onSuccess: () => {
				invalidateRatingQueries();
			},
		},
	});
}
