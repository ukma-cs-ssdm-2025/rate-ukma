import { useState } from "react";

import { MessageSquare, PenLine } from "lucide-react";

import { Button } from "@/components/ui/Button";
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
		<div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border/60 bg-muted/30 py-12 px-6 text-center">
			<MessageSquare className="h-10 w-10 text-muted-foreground/40" />
			<div className="space-y-1">
				<p className="text-base font-medium text-foreground">
					Будь першим, хто оцінить цей курс
				</p>
				<p className="text-sm text-muted-foreground">
					Твій відгук допоможе іншим студентам зробити усвідомлений вибір
				</p>
			</div>
			{showCta && (
				<Button
					size="lg"
					onClick={onRate}
					aria-disabled={!canRateButton}
					className="mt-2"
					data-testid={testIds.courseDetails.rateButton}
				>
					<PenLine className="mr-2 h-4 w-4" />
					Оцінити цей курс
				</Button>
			)}
		</div>
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
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div className="flex items-center gap-2">
					<MessageSquare className="h-5 w-5" />
					<h2 className="text-xl font-semibold">Відгуки студентів</h2>
					<span
						className="inline-flex h-5 items-center rounded-full bg-muted px-2 text-xs font-medium text-muted-foreground"
						data-testid={testIds.courseDetails.ratingsCountStat}
					>
						{displayCount}
					</span>
				</div>
				<div className="flex items-center gap-2">
					{showCta && !hasNoReviews && (
						<Button
							size="sm"
							onClick={onRate}
							aria-disabled={!canRateButton}
							data-testid={testIds.courseDetails.rateButton}
						>
							<PenLine className="mr-1.5 h-3.5 w-3.5" />
							Оцінити
						</Button>
					)}
					{displayCount > 0 && (
						<RatingsSortSelect
							value={sortOption}
							onValueChange={setSortOption}
						/>
					)}
				</div>
			</div>

			{userRating && onEditUserRating && onDeleteUserRating && (
				<UserRatingCard
					rating={userRating}
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
