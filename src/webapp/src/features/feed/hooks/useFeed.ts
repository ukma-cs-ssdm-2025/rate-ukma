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
	/** True only while a retry is in flight, so the first load stays a skeleton. */
	isRefetching: boolean;
	refetch: () => void;
	loaderRef: RefObject<HTMLDivElement | null>;
}

interface UseFeedOptions {
	limit?: number;
	/** Off for the homepage strip, which shows the first page only. */
	infinite?: boolean;
	/** Off keeps the query idle, so a gated feed issues no request. */
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
			// The first page carries no cursor; orval threads each subsequent
			// page param back in as `cursor`.
			initialPageParam: undefined,
			// The cursor is opaque: pass back whatever the server issued, and
			// stop when it stops issuing one.
			getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
			enabled,
		},
	});

	// The server leads the first page with pinned items, so pages concatenate.
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
		refetch,
		loaderRef,
	};
}
