import type { RefObject } from "react";
import { useEffect, useRef } from "react";

import { useInfiniteQuery } from "@tanstack/react-query";

import type { RatingRead } from "@/lib/api/generated";
import {
	coursesRatingsList,
	getCoursesRatingsListQueryKey,
} from "@/lib/api/generated";

export interface UseInfiniteScrollRatingsReturn {
	allRatings: RatingRead[];
	userRating: RatingRead | undefined;
	hasMoreRatings: boolean;
	isLoading: boolean;
	isFetchingNextPage: boolean;
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

	const params = {
		page_size: pageSize,
		separate_current_user: separateCurrentUser,
		time_order: timeOrder,
		order_by_popularity: popularityOrder,
	};

	const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
		useInfiniteQuery({
			queryKey: getCoursesRatingsListQueryKey(courseId, params),
			queryFn: ({ pageParam }) =>
				coursesRatingsList(courseId, { ...params, page: pageParam as number }),
			getNextPageParam: (lastPage) =>
				lastPage.page < lastPage.total_pages ? lastPage.page + 1 : undefined,
			initialPageParam: 1,
		});

	const allRatings = data?.pages.flatMap((p) => p.items.ratings) ?? [];
	const userRating = data?.pages[0]?.items.user_ratings?.[0];
	const totalRatings = data?.pages[0]?.total;

	const loaderRef = useRef<HTMLDivElement | null>(null);
	const fetchNextPageRef = useRef(fetchNextPage);
	fetchNextPageRef.current = fetchNextPage;

	useEffect(() => {
		if (!hasNextPage || (allRatings.length === 0 && !userRating)) {
			return;
		}

		const currentLoader = loaderRef.current;
		if (!currentLoader) {
			return;
		}

		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0].isIntersecting && !isFetchingNextPage && hasNextPage) {
					void fetchNextPageRef.current();
				}
			},
			{ threshold: 0, rootMargin: "100px" },
		);

		observer.observe(currentLoader);

		return () => {
			observer.unobserve(currentLoader);
			observer.disconnect();
		};
	}, [hasNextPage, allRatings.length, userRating, isFetchingNextPage]);

	return {
		allRatings,
		userRating,
		hasMoreRatings: !!hasNextPage,
		isLoading,
		isFetchingNextPage,
		loaderRef,
		totalRatings,
	};
}
