import type { RefObject } from "react";
import { useEffect, useMemo, useRef } from "react";

import type { FeedItem } from "@/lib/api/generated";
import { useFeedListInfinite } from "@/lib/api/generated";

const DEFAULT_PAGE_SIZE = 20;

export interface UseFeedReturn {
	items: FeedItem[];
	hasMore: boolean;
	isLoading: boolean;
	isError: boolean;
	isFetchingNextPage: boolean;
	isRefetching: boolean;
	refetch: () => void;
	loaderRef: RefObject<HTMLDivElement | null>;
}

interface UseFeedOptions {
	limit?: number;
	infinite?: boolean;
	enabled?: boolean;
}

export function useFeed(options: UseFeedOptions = {}): UseFeedReturn {
	const {
		limit = DEFAULT_PAGE_SIZE,
		infinite = true,
		enabled = true,
	} = options;
	const params = { limit };

	const {
		data,
		fetchNextPage,
		hasNextPage,
		isFetchingNextPage,
		isLoading,
		isError,
		isFetching,
		refetch,
	} = useFeedListInfinite(params, {
		query: {
			initialPageParam: undefined,
			getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
			enabled,
		},
	});

	const items = useMemo(
		() => data?.pages.flatMap((page) => page.items) ?? [],
		[data],
	);

	const loaderRef = useRef<HTMLDivElement | null>(null);
	const fetchNextPageRef = useRef(fetchNextPage);
	fetchNextPageRef.current = fetchNextPage;

	useEffect(() => {
		if (!infinite || !hasNextPage || items.length === 0) {
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
	}, [infinite, hasNextPage, items.length, isFetchingNextPage]);

	return {
		items,
		hasMore: !!hasNextPage,
		isLoading,
		isError,
		isFetchingNextPage,
		isRefetching: isFetching && !isLoading,
		refetch: () => {
			void refetch();
		},
		loaderRef,
	};
}
