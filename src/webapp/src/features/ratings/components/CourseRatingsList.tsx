import { useLayoutEffect, useRef, useState } from "react";

import { MessageSquare } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/Empty";
import { Skeleton } from "@/components/ui/Skeleton";
import { Spinner } from "@/components/ui/Spinner";
import type { InlineRating, RatingRead } from "@/lib/api/generated";
import { testIds } from "@/lib/test-ids";
import { RatingCard } from "./RatingCard";
import { RatingsSortSelect, type SortOption } from "./RatingsSortSelect";
import { UserRatingCard } from "./UserRatingCard";
import {
	CANNOT_VOTE_BEFORE_MIDTERM_TEXT,
	CANNOT_VOTE_WITHOUT_ATTENDING_TEXT,
} from "../definitions/ratingDefinitions";
import { useInfiniteScrollRatings } from "../hooks/useInfiniteScrollRatings";
import { orderByPopularity, type VoteCounts } from "../ratingPopularity";
import type { OnVoteSettled } from "./RatingVotes";

const SKELETON_RATINGS_COUNT = 3;
const SKELETON_KEYS = Array.from(
	{ length: SKELETON_RATINGS_COUNT },
	(_, i) => `rating-skeleton-${i}`,
);

interface CourseRatingsListProps {
	courseId: string;
	userRating?: InlineRating | RatingRead | null;
	onEditUserRating?: () => void;
	onDeleteUserRating?: () => void;
	hasAttended: boolean;
	canRate: boolean;
	// When the course only ever runs in one term, reviews show the academic year alone.
	singleTerm?: boolean;
}

interface RatingsContentProps {
	allRatings: RatingRead[];
	hasMoreRatings: boolean;
	isLoadingMore: boolean;
	loaderRef: React.RefObject<HTMLDivElement | null>;
	hasUserRating: boolean;
	voteDisabledReason?: string;
	courseId: string;
	singleTerm: boolean;
	listRef: React.RefObject<HTMLDivElement | null>;
	onVoteSettled: OnVoteSettled;
}

function emptyDescription(hasAttended: boolean, canRate: boolean): string {
	if (!hasAttended) return "Їх залишають студенти, які слухали цей курс.";
	if (!canRate) {
		return "Перші відгуки з'являться, коли відкриється оцінювання.";
	}
	return "Ваш відгук може стати першим.";
}

function EmptyState({
	hasAttended,
	canRate,
}: Readonly<{
	hasAttended: boolean;
	canRate: boolean;
}>) {
	return (
		<Empty
			className="border-0 py-16"
			data-testid={testIds.courseDetails.noReviewsMessage}
		>
			<EmptyHeader>
				<EmptyMedia variant="icon">
					<MessageSquare />
				</EmptyMedia>
				<EmptyTitle>Відгуків ще немає</EmptyTitle>
				<EmptyDescription>
					{emptyDescription(hasAttended, canRate)}
				</EmptyDescription>
			</EmptyHeader>
		</Empty>
	);
}

function RatingsContent({
	allRatings,
	hasMoreRatings,
	isLoadingMore,
	loaderRef,
	hasUserRating,
	voteDisabledReason,
	courseId,
	singleTerm,
	listRef,
	onVoteSettled,
}: Readonly<RatingsContentProps>) {
	if (allRatings.length === 0 && hasUserRating) {
		return null;
	}

	return (
		<div ref={listRef} className="divide-y divide-border/30">
			{allRatings.map((rating) => (
				<RatingCard
					key={rating.id}
					rating={rating}
					courseId={courseId}
					singleTerm={singleTerm}
					voteDisabledReason={voteDisabledReason}
					onVoteSettled={onVoteSettled}
				/>
			))}

			{hasMoreRatings && (
				<div
					ref={loaderRef}
					className="flex justify-center py-4 min-h-[60px]"
					data-testid={testIds.common.infiniteScrollLoader}
				>
					{isLoadingMore ? (
						<div className="flex items-center gap-2 text-muted-foreground">
							<Spinner className="size-4" />
							<span className="text-xs">Завантаження...</span>
						</div>
					) : (
						<div className="h-1 w-full" aria-hidden="true" />
					)}
				</div>
			)}
		</div>
	);
}

export function CourseRatingsList({
	courseId,
	userRating: userRatingProp,
	onEditUserRating,
	onDeleteUserRating,
	hasAttended,
	canRate,
	singleTerm = false,
}: Readonly<CourseRatingsListProps>) {
	const separateCurrentUser = !!userRatingProp;
	const [sortOption, setSortOption] = useState<SortOption>("most-popular");

	let voteDisabledReason: string | undefined;
	if (!hasAttended) voteDisabledReason = CANNOT_VOTE_WITHOUT_ATTENDING_TEXT;
	else if (!canRate) voteDisabledReason = CANNOT_VOTE_BEFORE_MIDTERM_TEXT;

	const getSortParams = (option: SortOption) => {
		switch (option) {
			case "newest":
				return { timeOrder: "desc" as const, popularityOrder: undefined };
			case "oldest":
				return { timeOrder: "asc" as const, popularityOrder: undefined };
			case "most-popular":
				return { popularityOrder: true, timeOrder: undefined };
		}
	};

	const sortParams = getSortParams(sortOption);

	const {
		allRatings,
		hasMoreRatings,
		isLoading,
		isFetchingNextPage,
		loaderRef,
		totalRatings,
		userRating: userRatingFromApi,
	} = useInfiniteScrollRatings(courseId, {
		separateCurrentUser,
		...sortParams,
	});

	// Settled local votes re-rank the loaded reviews without waiting for a refetch.
	const [voteOverrides, setVoteOverrides] = useState<
		Record<string, VoteCounts>
	>({});
	const listRef = useRef<HTMLDivElement>(null);
	const positionsBeforeVote = useRef<Map<string, number> | null>(null);

	const handleVoteSettled: OnVoteSettled = (ratingId, counts) => {
		const positions = new Map<string, number>();
		for (const node of listRef.current?.querySelectorAll<HTMLElement>(
			"[data-rating-id]",
		) ?? []) {
			positions.set(
				node.dataset.ratingId ?? "",
				node.getBoundingClientRect().top,
			);
		}
		positionsBeforeVote.current = positions;
		setVoteOverrides((prev) => ({ ...prev, [ratingId]: counts }));
	};

	const orderedRatings =
		sortOption === "most-popular"
			? orderByPopularity(allRatings, voteOverrides)
			: allRatings;

	// FLIP: reviews that swapped places glide from where they were.
	useLayoutEffect(() => {
		const before = positionsBeforeVote.current;
		positionsBeforeVote.current = null;
		if (!before) return;
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
		for (const node of listRef.current?.querySelectorAll<HTMLElement>(
			"[data-rating-id]",
		) ?? []) {
			const from = before.get(node.dataset.ratingId ?? "");
			if (from == null) continue;
			const delta = from - node.getBoundingClientRect().top;
			if (Math.abs(delta) < 1) continue;
			node.animate(
				[{ transform: `translateY(${delta}px)` }, { transform: "none" }],
				{ duration: 450, easing: "cubic-bezier(0.2, 0, 0, 1)" },
			);
		}
	}, [voteOverrides]);

	const userRating = userRatingFromApi ?? userRatingProp;
	const displayCount = totalRatings ?? 0;
	const hasNoReviews = displayCount === 0 && !userRating;

	return (
		<div
			className="space-y-4"
			data-testid={testIds.courseDetails.reviewsSection}
		>
			<div className="flex min-w-0 items-center justify-between gap-2">
				<h2 className="flex min-w-0 items-center gap-2 text-lg font-semibold tracking-tight">
					<span className="truncate">Відгуки</span>
					<Badge
						variant="secondary"
						data-testid={testIds.courseDetails.ratingsCountStat}
					>
						{displayCount}
					</Badge>
				</h2>
				{displayCount > 0 ? (
					<RatingsSortSelect value={sortOption} onValueChange={setSortOption} />
				) : null}
			</div>

			{userRating && onEditUserRating && onDeleteUserRating && (
				<UserRatingCard
					rating={userRating}
					courseId={courseId}
					singleTerm={singleTerm}
					onEdit={onEditUserRating}
					onDelete={onDeleteUserRating}
				/>
			)}

			{isLoading ? (
				<CourseRatingsListSkeleton />
			) : hasNoReviews ? (
				<EmptyState hasAttended={hasAttended} canRate={canRate} />
			) : (
				<RatingsContent
					allRatings={orderedRatings}
					hasMoreRatings={hasMoreRatings}
					isLoadingMore={isFetchingNextPage}
					loaderRef={loaderRef}
					hasUserRating={!!userRating}
					voteDisabledReason={voteDisabledReason}
					courseId={courseId}
					singleTerm={singleTerm}
					listRef={listRef}
					onVoteSettled={handleVoteSettled}
				/>
			)}
		</div>
	);
}

export function CourseRatingsListSkeleton() {
	return (
		<div className="divide-y divide-border/30">
			{SKELETON_KEYS.map((key) => (
				<div key={key} className="space-y-2 px-4 py-4 sm:px-5">
					<div className="flex items-center justify-between gap-3">
						<div className="flex items-center gap-2.5">
							<Skeleton className="size-8 rounded-full" />
							<div className="space-y-1">
								<Skeleton className="h-3.5 w-24" />
								<Skeleton className="h-3 w-20" />
							</div>
						</div>
						<Skeleton className="h-3 w-40" />
					</div>
					<Skeleton className="h-14 w-full" />
				</div>
			))}
		</div>
	);
}
