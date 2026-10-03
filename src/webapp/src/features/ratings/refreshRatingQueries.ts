import type { QueryClient } from "@tanstack/react-query";

import {
	getCoursesListQueryKey,
	getCoursesRatingsListQueryKey,
	getCoursesRetrieveQueryKey,
	getFeedListInfiniteQueryKey,
	getStudentsMeCoursesRetrieveQueryKey,
	getStudentsMeGradesRetrieveQueryKey,
	getStudentsMeRatingSuggestionsListQueryKey,
} from "@/lib/api/generated";

export function refreshRatingQueries(
	queryClient: QueryClient,
	courseId: string,
) {
	const pageKeys = [
		getCoursesRatingsListQueryKey(courseId),
		getCoursesRetrieveQueryKey(courseId),
		getStudentsMeCoursesRetrieveQueryKey(),
		getStudentsMeGradesRetrieveQueryKey(),
	];
	for (const queryKey of [
		getStudentsMeRatingSuggestionsListQueryKey(),
		getCoursesListQueryKey(),
		getFeedListInfiniteQueryKey(),
	]) {
		void queryClient.invalidateQueries({ queryKey });
	}
	return Promise.all(
		pageKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
	);
}
