import type { RefObject } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import type { RatingRead } from "@/lib/api/generated";
import { useCoursesRatingsList } from "@/lib/api/generated";

interface UseInfiniteScrollRatingsReturn {
	allRatings: RatingRead[];
	hasMoreRatings: boolean;
	isLoading: boolean;
	loaderRef: RefObject<HTMLDivElement | null>;
	totalRatings: number | undefined;
}

interface UseInfiniteScrollRatingsOptions {
	pageSize?: number;
	excludeCurrentUser?: boolean;
}

const DEFAULT_PAGE_SIZE = 10;

export function useInfiniteScrollRatings(
	courseId: string,
	options: UseInfiniteScrollRatingsOptions = {},
): UseInfiniteScrollRatingsReturn {
	const { pageSize = DEFAULT_PAGE_SIZE, excludeCurrentUser = false } = options;

	const [ratingsPage, setRatingsPage] = useState(1);
	const [allRatings, setAllRatings] = useState<RatingRead[]>([]);

	const { data: ratings, isLoading: isRatingsLoading } = useCoursesRatingsList(
		courseId,
		{
			page: ratingsPage,
			page_size: pageSize,
			exclude_current_user: excludeCurrentUser,
		},
	);

	const loaderRef = useRef<HTMLDivElement | null>(null);

	const hasMoreRatings = useMemo(
		() => (ratings ? ratingsPage < ratings.total_pages : false),
		[ratings, ratingsPage],
	);

	useEffect(() => {
		if (ratings?.items) {
			setAllRatings((prev) => {
				if (ratingsPage === 1) {
					return ratings.items;
				}
				const existingIds = new Set(prev.map((r) => r.id));
				const newItems = ratings.items.filter((r) => !existingIds.has(r.id));
				return [...prev, ...newItems];
			});
		}
	}, [ratings, ratingsPage]);

	useEffect(() => {
		if (!hasMoreRatings || allRatings.length === 0) {
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
	}, [hasMoreRatings, allRatings.length, isRatingsLoading]);

	return {
		allRatings,
		hasMoreRatings,
		isLoading: isRatingsLoading,
		loaderRef,
		totalRatings: ratings?.total,
	};
}
