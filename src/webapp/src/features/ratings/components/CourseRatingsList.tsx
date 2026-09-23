import { useState } from "react";

import { MessageSquare } from "lucide-react";

import { SectionHeader } from "@/components/SectionHeader";
import { Badge } from "@/components/ui/Badge";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/Empty";
import { Skeleton } from "@/components/ui/Skeleton";
import { Spinner } from "@/components/ui/Spinner";
import type { InlineRating, RatingRead } from "@/lib/api/generated";
import { testIds } from "@/lib/test-ids";
import { RatingButton } from "./RatingButton";
import { RatingCard } from "./RatingCard";
import { RatingsSortSelect, type SortOption } from "./RatingsSortSelect";
import { UserRatingCard } from "./UserRatingCard";
import {
	CANNOT_VOTE_BEFORE_MIDTERM_TEXT,
	CANNOT_VOTE_WITHOUT_ATTENDING_TEXT,
} from "../definitions/ratingDefinitions";
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
	hasAttended?: boolean;
	canRate?: boolean;
	showCta?: boolean;
	canRateButton?: boolean;
	onRate?: () => void;
}

interface RatingsContentProps {
	allRatings: RatingRead[];
	hasMoreRatings: boolean;
	isLoadingMore: boolean;
	loaderRef: React.RefObject<HTMLDivElement | null>;
	hasUserRating: boolean;
	canVote?: boolean;
	disabledMessage?: string;
	courseId: string;
}

function EmptyState({
	showCta,
	canRateButton,
	onRate,
}: Readonly<{
	showCta: boolean;
	canRateButton: boolean;
	onRate?: () => void;
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
				<EmptyTitle>Будь першим, хто оцінить цей курс</EmptyTitle>
				<EmptyDescription>
					Твій відгук допоможе іншим студентам зробити усвідомлений вибір
				</EmptyDescription>
			</EmptyHeader>
			{showCta && (
				<EmptyContent>
					<RatingButton canRate={canRateButton} onClick={onRate} size="lg">
						Оцінити цей курс
					</RatingButton>
				</EmptyContent>
			)}
		</Empty>
	);
}

function RatingsContent({
	allRatings,
	hasMoreRatings,
	isLoadingMore,
	loaderRef,
	hasUserRating,
	canVote = true,
	disabledMessage,
	courseId,
}: Readonly<RatingsContentProps>) {
	if (allRatings.length === 0 && hasUserRating) {
		return null;
	}

	return (
		<div className="divide-y divide-border/30">
			{allRatings.map((rating) => (
				<RatingCard
					key={rating.id}
					rating={rating}
					courseId={courseId}
					readOnly={!canVote}
					disabledMessage={disabledMessage}
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
	hasAttended = true,
	canRate = true,
	showCta = false,
	canRateButton = false,
	onRate,
}: Readonly<CourseRatingsListProps>) {
	const separateCurrentUser = !!userRatingProp;
	const [sortOption, setSortOption] = useState<SortOption>("most-popular");

	const getDisabledMessage = () => {
		if (canVote) return undefined;
		if (!hasAttended) return CANNOT_VOTE_WITHOUT_ATTENDING_TEXT;
		if (!canRate) return CANNOT_VOTE_BEFORE_MIDTERM_TEXT;
		return undefined;
	};

	const disabledMessage = getDisabledMessage();

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

	const userRating = userRatingFromApi ?? userRatingProp;
	const displayCount = totalRatings ?? 0;
	const hasNoReviews = displayCount === 0 && !userRating;

	return (
		<div
			className="space-y-4"
			data-testid={testIds.courseDetails.reviewsSection}
		>
			<SectionHeader
				className="flex-row items-center justify-between"
				title="Відгуки студентів"
				meta={
					<Badge
						variant="secondary"
						data-testid={testIds.courseDetails.ratingsCountStat}
					>
						{displayCount}
					</Badge>
				}
				actions={
					(showCta && !hasNoReviews) || displayCount > 0 ? (
						<>
							{showCta && !hasNoReviews && (
								<RatingButton
									canRate={canRateButton}
									onClick={onRate}
									size="sm"
								>
									Оцінити
								</RatingButton>
							)}
							{displayCount > 0 && (
								<RatingsSortSelect
									value={sortOption}
									onValueChange={setSortOption}
								/>
							)}
						</>
					) : undefined
				}
			/>

			{userRating && onEditUserRating && onDeleteUserRating && (
				<UserRatingCard
					rating={userRating}
					courseId={courseId}
					onEdit={onEditUserRating}
					onDelete={onDeleteUserRating}
				/>
			)}

			{isLoading ? (
				<CourseRatingsListSkeleton />
			) : hasNoReviews ? (
				<EmptyState
					showCta={showCta}
					canRateButton={canRateButton}
					onRate={onRate}
				/>
			) : (
				<RatingsContent
					allRatings={allRatings}
					hasMoreRatings={hasMoreRatings}
					isLoadingMore={isFetchingNextPage}
					loaderRef={loaderRef}
					hasUserRating={!!userRating}
					canVote={canVote}
					disabledMessage={disabledMessage}
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
						<div className="flex items-center gap-2.5">
							<Skeleton className="h-8 w-8 rounded-full" />
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
