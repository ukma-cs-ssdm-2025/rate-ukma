import type { RefObject } from "react";
import { useEffect, useMemo, useRef } from "react";

import { useInfiniteQuery } from "@tanstack/react-query";

import type { FeedItem as ApiFeedItem } from "@/lib/api/generated";
import { feedList, getFeedListQueryKey } from "@/lib/api/generated";
import type {
	FeedItem,
	FeedPromoAccent,
	FeedPromoItem,
	FeedReviewItem,
} from "../feedTypes";
import { orderFeedItems } from "../feedTypes";

const DEFAULT_PAGE_SIZE = 20;

export interface UseFeedReturn {
	items: FeedItem[];
	hasMore: boolean;
	isLoading: boolean;
	isError: boolean;
	isFetchingNextPage: boolean;
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
	} = useInfiniteQuery({
		queryKey: getFeedListQueryKey(params),
		queryFn: ({ pageParam }) =>
			feedList({ ...params, cursor: (pageParam as string) ?? undefined }),
		// The cursor is opaque: pass back whatever the server issued, and stop
		// when it stops issuing one.
		getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
		initialPageParam: null as string | null,
		enabled,
	});

	const items = useMemo(
		() =>
			orderFeedItems(
				data?.pages.flatMap((page) => page.items?.map(toFeedItem) ?? []) ?? [],
			),
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
		loaderRef,
	};
}

// Every field but `kind` generates as optional, since DRF marks read-only
// fields as not required. Defaults keep the render path total.
function toFeedItem(item: ApiFeedItem): FeedItem {
	return item.kind === "promo" ? toPromoItem(item) : toReviewItem(item);
}

function toReviewItem(item: Extract<ApiFeedItem, { kind: "review" }>) {
	return {
		kind: "review",
		id: item.id ?? "",
		createdAt: item.occurred_at ?? "",
		courseId: item.course_id ?? "",
		courseTitle: item.course_title ?? "",
		difficulty: item.difficulty ?? 0,
		usefulness: item.usefulness ?? 0,
		comment: item.comment ?? "",
		courseAvgDifficulty: item.course_avg_difficulty ?? 0,
		courseAvgUsefulness: item.course_avg_usefulness ?? 0,
		semesterYear: item.semester_year,
		semesterTerm: item.semester_term,
	} satisfies FeedReviewItem;
}

function toPromoItem(item: Extract<ApiFeedItem, { kind: "promo" }>) {
	return {
		kind: "promo",
		id: item.id ?? "",
		createdAt: item.occurred_at ?? "",
		pinned: item.pinned,
		title: item.title ?? "",
		body: item.body ?? "",
		label: item.label || undefined,
		ctaLabel: item.cta_label || undefined,
		ctaHref: item.cta_href || undefined,
		imageUrl: item.image_url,
		accent: item.accent as FeedPromoAccent | undefined,
	} satisfies FeedPromoItem;
}
