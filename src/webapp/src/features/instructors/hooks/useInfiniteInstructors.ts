import type { RefObject } from "react";
import { useEffect, useMemo, useRef } from "react";

import type { Instructor, InstructorsListParams } from "@/lib/api/generated";
import { useInstructorsListInfinite } from "@/lib/api/generated";

export interface UseInfiniteInstructorsReturn {
	allInstructors: Instructor[];
	total: number | undefined;
	hasMore: boolean;
	isLoading: boolean;
	isFetchingNextPage: boolean;
	loaderRef: RefObject<HTMLDivElement | null>;
}

export interface UseInfiniteInstructorsOptions {
	readonly search?: string;
	readonly courseOfferingId?: string;
	readonly specialityId?: string;
	readonly pageSize?: number;
	readonly enabled?: boolean;
}

const DEFAULT_PAGE_SIZE = 20;

export function useInfiniteInstructors({
	search,
	courseOfferingId,
	specialityId,
	pageSize = DEFAULT_PAGE_SIZE,
	enabled = true,
}: UseInfiniteInstructorsOptions = {}): UseInfiniteInstructorsReturn {
	const params = useMemo<InstructorsListParams>(
		() => ({
			page_size: pageSize,
			...(search ? { search } : {}),
			...(courseOfferingId ? { course_offering_id: courseOfferingId } : {}),
			...(specialityId ? { speciality_id: specialityId } : {}),
		}),
		[search, courseOfferingId, specialityId, pageSize],
	);

	const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
		useInstructorsListInfinite(params, {
			query: {
				initialPageParam: 1,
				getNextPageParam: (lastPage) => lastPage.next_page ?? undefined,
				enabled,
			},
		});

	const allInstructors = data?.pages.flatMap((p) => p.items) ?? [];
	const total = data?.pages[0]?.total;

	const loaderRef = useRef<HTMLDivElement | null>(null);
	const fetchNextPageRef = useRef(fetchNextPage);
	fetchNextPageRef.current = fetchNextPage;

	useEffect(() => {
		if (!hasNextPage || allInstructors.length === 0) {
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
	}, [hasNextPage, allInstructors.length, isFetchingNextPage]);

	return {
		allInstructors,
		total,
		hasMore: !!hasNextPage,
		isLoading,
		isFetchingNextPage,
		loaderRef,
	};
}
