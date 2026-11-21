import { useCallback, useState } from "react";

import { localStorageAdapter } from "@/lib/storage";
import { SORT_OPTIONS } from "../components/RatingsSortSelect";
import type { SortOption } from "../components/RatingsSortSelect";

export const RATINGS_SORT_STORAGE_KEY = "course-ratings-sort";
const DEFAULT_SORT: SortOption = "most-popular";

function isSortOption(value: unknown): value is SortOption {
	return SORT_OPTIONS.some((option) => option.value === value);
}

/**
 * The reviews sort on the course page, remembered across courses and visits.
 * A stored value that is no longer a valid option falls back to the default.
 */
export function useRatingsSortOption() {
	const [sortOption, setSortOptionState] = useState<SortOption>(() => {
		const stored = localStorageAdapter.getItem<unknown>(
			RATINGS_SORT_STORAGE_KEY,
		);
		return isSortOption(stored) ? stored : DEFAULT_SORT;
	});

	const setSortOption = useCallback((next: SortOption) => {
		localStorageAdapter.setItem(RATINGS_SORT_STORAGE_KEY, next);
		setSortOptionState(next);
	}, []);

	return [sortOption, setSortOption] as const;
}
