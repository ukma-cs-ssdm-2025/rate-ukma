import { MessageSquare } from "lucide-react";

import { Skeleton } from "@/components/ui/Skeleton";
import { Spinner } from "@/components/ui/Spinner";
import type { RatingRead } from "@/lib/api/generated";
import { testIds } from "@/lib/test-ids";
import { RatingCard } from "./RatingCard";
import { useInfiniteScrollRatings } from "../hooks/useInfiniteScrollRatings";

const SKELETON_RATINGS_COUNT = 3;
const SKELETON_KEYS = Array.from(
	{ length: SKELETON_RATINGS_COUNT },
	(_, i) => `rating-skeleton-${i}`,
);

interface CourseRatingsListProps {
	courseId: string;
}

interface RatingsContentProps {
	allRatings: RatingRead[];
	hasMoreRatings: boolean;
	isLoading: boolean;
	loaderRef: React.RefObject<HTMLDivElement | null>;
}

function RatingsContent({
	allRatings,
	hasMoreRatings,
	isLoading,
	loaderRef,
}: Readonly<RatingsContentProps>) {
	if (allRatings.length === 0) {
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
				<RatingCard key={rating.id} rating={rating} />
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
}: Readonly<CourseRatingsListProps>) {
	const { allRatings, hasMoreRatings, isLoading, loaderRef, totalRatings } =
		useInfiniteScrollRatings(courseId);

	const showSkeleton = isLoading && allRatings.length === 0;

	return (
		<div
			className="space-y-4"
			data-testid={testIds.courseDetails.reviewsSection}
		>
			<div className="flex items-center gap-2">
				<MessageSquare className="h-5 w-5" />
				<h2 className="text-xl font-semibold">Відгуки студентів</h2>
				{totalRatings !== undefined && totalRatings > 0 && (
					<span className="text-sm text-muted-foreground">
						({totalRatings})
					</span>
				)}
			</div>

			{showSkeleton ? (
				<CourseRatingsListSkeleton />
			) : (
				<RatingsContent
					allRatings={allRatings}
					hasMoreRatings={hasMoreRatings}
					isLoading={isLoading}
					loaderRef={loaderRef}
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
