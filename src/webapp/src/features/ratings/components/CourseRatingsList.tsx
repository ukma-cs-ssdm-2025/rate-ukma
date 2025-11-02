import { MessageSquare } from "lucide-react";

import { Skeleton } from "@/components/ui/Skeleton";
import { Spinner } from "@/components/ui/Spinner";
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

export function CourseRatingsList({ courseId }: CourseRatingsListProps) {
	const { allRatings, hasMoreRatings, isLoading, loaderRef, totalRatings } =
		useInfiniteScrollRatings(courseId);

	return (
		<div className="space-y-4">
			<div className="flex items-center gap-2">
				<MessageSquare className="h-5 w-5" />
				<h2 className="text-xl font-semibold">Відгуки студентів</h2>
				{totalRatings !== undefined && totalRatings > 0 && (
					<span className="text-sm text-muted-foreground">
						({totalRatings})
					</span>
				)}
			</div>

			{isLoading && allRatings.length === 0 ? (
				<CourseRatingsListSkeleton />
			) : allRatings.length > 0 ? (
				<div className="divide-y divide-border/30">
					{allRatings.map((rating) => (
						<RatingCard key={rating.id} rating={rating} />
					))}

					{hasMoreRatings && (
						<div
							ref={loaderRef}
							className="flex justify-center py-4 min-h-[60px]"
							data-testid="infinite-scroll-loader"
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
			) : (
				<p className="text-center text-sm text-muted-foreground py-8">
					Поки що немає відгуків для цього курсу
				</p>
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
