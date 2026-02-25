import { useState } from "react";

import { MessageSquare } from "lucide-react";

import { Skeleton } from "@/components/ui/Skeleton";
import { Spinner } from "@/components/ui/Spinner";
import type { InlineRating, RatingRead } from "@/lib/api/generated";
import { testIds } from "@/lib/test-ids";
import { RatingCard } from "./RatingCard";
import { RatingsSortSelect, type SortOption } from "./RatingsSortSelect";
import { UserRatingCard } from "./UserRatingCard";
import { CANNOT_VOTE_WITHOUT_ATTENDING_TEXT } from "../definitions/ratingDefinitions";
import { useInfiniteScrollRatings } from "../hooks/useInfiniteScrollRatings";

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
	canVote?: boolean;
}

interface RatingsContentProps {
	allRatings: RatingRead[];
	hasMoreRatings: boolean;
	isLoading: boolean;
	loaderRef: React.RefObject<HTMLDivElement | null>;
	hasUserRating: boolean;
	canVote?: boolean;
	courseId: string;
}

function RatingsContent({
	allRatings,
	hasMoreRatings,
	isLoading,
	loaderRef,
	hasUserRating,
	canVote = true,
	courseId,
}: Readonly<RatingsContentProps>) {
	if (allRatings.length === 0) {
		if (hasUserRating) {
			return null;
		}
		return (
			<p
				className="text-center text-sm text-muted-foreground py-8"
				data-testid={testIds.courseDetails.noReviewsMessage}
			>
				Поки що немає відгуків для цього курсу
			</p>
		);
	}

	return (
		<div className="divide-y divide-border/30">
			{allRatings.map((rating) => (
				<RatingCard
					key={rating.id}
					rating={rating}
					courseId={courseId}
					readOnly={!canVote}
					disabledMessage={
						canVote ? undefined : CANNOT_VOTE_WITHOUT_ATTENDING_TEXT
					}
				/>
			))}

			{hasMoreRatings && (
				<div
					ref={loaderRef}
					className="flex justify-center py-4 min-h-[60px]"
					data-testid={testIds.common.infiniteScrollLoader}
				>
					{isLoading ? (
						<div className="flex items-center gap-2 text-muted-foreground">
							<Spinner className="h-4 w-4" />
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
	canVote = true,
}: Readonly<CourseRatingsListProps>) {
	const separateCurrentUser = !!userRatingProp;
	const [sortOption, setSortOption] = useState<SortOption>("most-popular");

	// Convert sort option to API parameters
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
		isFetching,
		loaderRef,
		totalRatings,
		userRating: userRatingFromApi,
	} = useInfiniteScrollRatings(courseId, {
		separateCurrentUser,
		...sortParams,
	});

	// Prefer user rating from API (has vote data) over prop (from different endpoint)
	const userRating = userRatingFromApi ?? userRatingProp;

	// Total from backend already reflects the number of items
	// including non-current user ratings and current user rating (if any)
	// when separate_current_user is true.
	const displayCount = totalRatings ?? 0;

	return (
		<div
			className="space-y-4"
			data-testid={testIds.courseDetails.reviewsSection}
		>
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div className="flex items-center gap-2">
					<MessageSquare className="h-5 w-5" />
					<h2 className="text-xl font-semibold">Відгуки студентів</h2>
					{displayCount > 0 && (
						<span className="text-sm text-muted-foreground">
							({displayCount})
						</span>
					)}
				</div>
				{displayCount > 0 && (
					<RatingsSortSelect value={sortOption} onValueChange={setSortOption} />
				)}
			</div>

			{userRating && onEditUserRating && onDeleteUserRating && (
				<UserRatingCard
					rating={userRating}
					onEdit={onEditUserRating}
					onDelete={onDeleteUserRating}
				/>
			)}

			{isFetching ? (
				<CourseRatingsListSkeleton />
			) : (
				<RatingsContent
					allRatings={allRatings}
					hasMoreRatings={hasMoreRatings}
					isLoading={isFetching}
					loaderRef={loaderRef}
					hasUserRating={!!userRating}
					canVote={canVote}
					courseId={courseId}
				/>
			)}
		</div>
	);
}

export function CourseRatingsListSkeleton() {
	return (
		<div className="divide-y divide-border/30">
			{SKELETON_KEYS.map((key) => (
				<div key={key} className="py-4 space-y-2">
					<div className="flex items-center justify-between gap-3">
						<div className="flex items-center gap-2">
							<Skeleton className="h-3 w-24" />
							<Skeleton className="h-3 w-20" />
						</div>
						<Skeleton className="h-3 w-40" />
					</div>
					<Skeleton className="h-14 w-full" />
				</div>
			))}
		</div>
	);
}
