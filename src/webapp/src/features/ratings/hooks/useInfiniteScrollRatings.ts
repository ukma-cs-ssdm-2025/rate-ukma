import type { RefObject } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import type { RatingRead } from "@/lib/api/generated";
import { useCoursesRatingsList } from "@/lib/api/generated";

export interface UseInfiniteScrollRatingsReturn {
	allRatings: RatingRead[];
	userRating: RatingRead | undefined;
	hasMoreRatings: boolean;
	isLoading: boolean;
	loaderRef: RefObject<HTMLDivElement | null>;
	totalRatings: number | undefined;
}

interface UseInfiniteScrollRatingsOptions {
	pageSize?: number;
	separateCurrentUser?: boolean;
	timeOrder?: "asc" | "desc";
	popularityOrder?: boolean;
}

const DEFAULT_PAGE_SIZE = 10;

export function useInfiniteScrollRatings(
	courseId: string,
	options: UseInfiniteScrollRatingsOptions = {},
): UseInfiniteScrollRatingsReturn {
	const {
		pageSize = DEFAULT_PAGE_SIZE,
		separateCurrentUser = false,
		timeOrder,
		popularityOrder,
	} = options;

	const [ratingsPage, setRatingsPage] = useState(1);
	const [lastCourseId, setLastCourseId] = useState(courseId);
	const [lastSortOptions, setLastSortOptions] = useState({
		timeOrder,
		popularityOrder,
	});
	const [allRatings, setAllRatings] = useState<RatingRead[]>([]);
	const [userRating, setUserRating] = useState<RatingRead | undefined>();

	// Reset pagination and state when courseId or sorting changes
	useEffect(() => {
		const sortOptionsChanged =
			lastSortOptions.timeOrder !== timeOrder ||
			lastSortOptions.popularityOrder !== popularityOrder;

		if (courseId !== lastCourseId || sortOptionsChanged) {
			setRatingsPage(1);
			setAllRatings([]);
			setUserRating(undefined);
			setLastCourseId(courseId);
			setLastSortOptions({ timeOrder, popularityOrder });
		}
	}, [courseId, timeOrder, popularityOrder, lastCourseId, lastSortOptions]);

	const { data: ratings, isLoading: isRatingsLoading } = useCoursesRatingsList(
		courseId,
		{
			page: ratingsPage,
			page_size: pageSize,
			separate_current_user: separateCurrentUser,
			time_order: timeOrder,
			order_by_popularity: popularityOrder,
		},
	);

	const loaderRef = useRef<HTMLDivElement | null>(null);

	const hasMoreRatings = useMemo(
		() => (ratings ? ratingsPage < ratings.total_pages : false),
		[ratings, ratingsPage],
	);

	useEffect(() => {
		if (ratings?.items) {
			const ratingsList = ratings.items.ratings;
			const currentUserRatings = ratings.items.user_ratings;

			if (currentUserRatings && currentUserRatings.length > 0) {
				setUserRating(currentUserRatings[0]);
			} else if (ratingsPage === 1) {
				setUserRating(undefined);
			}

			setAllRatings((prev) => {
				if (ratingsPage === 1) {
					// Always replace when on page 1 (initial load or after reset)
					return ratingsList;
				}
				const existingIds = new Set(prev.map((r) => r.id));
				const newItems = ratingsList.filter((r) => !existingIds.has(r.id));
				return [...prev, ...newItems];
			});
		}
	}, [ratings, ratingsPage]);

	useEffect(() => {
		if (!hasMoreRatings || (allRatings.length === 0 && !userRating)) {
			return;
		}

		const currentLoader = loaderRef.current;
		if (!currentLoader) {
			return;
		}

		const observer = new IntersectionObserver(
			(entries) => {
				const target = entries[0];
				if (target.isIntersecting && !isRatingsLoading) {
					setRatingsPage((prev) => prev + 1);
				}
			},
			{
				threshold: 0,
				rootMargin: "100px",
			},
		);

		observer.observe(currentLoader);

		return () => {
			observer.unobserve(currentLoader);
			observer.disconnect();
		};
	}, [hasMoreRatings, allRatings.length, isRatingsLoading, userRating]);

	return {
		allRatings,
		userRating,
		hasMoreRatings,
		isLoading: isRatingsLoading,
		loaderRef,
		totalRatings: ratings?.total,
	};
}
