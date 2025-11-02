import { MessageSquare } from "lucide-react";

import { Skeleton } from "@/components/ui/Skeleton";
import { Spinner } from "@/components/ui/Spinner";
import { RatingCard } from "./RatingCard";
import { useInfiniteScrollRatings } from "../hooks/useInfiniteScrollRatings";

interface CourseRatingsListProps {
	courseId: string;
}

export function CourseRatingsList({ courseId }: CourseRatingsListProps) {
	const { allRatings, hasMoreRatings, isLoading, loaderRef, totalRatings } =
		useInfiniteScrollRatings(courseId);

	return (
		<div className="space-y-4">
			<div className="flex items-center gap-2">
				<MessageSquare className="h-6 w-6" />
				<h2 className="text-2xl font-semibold">Відгуки студентів</h2>
				{totalRatings && (
					<span className="text-lg text-muted-foreground">
						({totalRatings})
					</span>
				)}
			</div>

			{isLoading && allRatings.length === 0 ? (
				<div className="space-y-4">
					{[...Array(3)].map((_, i) => (
						<div
							key={`skeleton-rating-${i.toString()}`}
							className="space-y-2 p-4 border rounded-lg"
						>
							<Skeleton className="h-4 w-24" />
							<Skeleton className="h-16 w-full" />
						</div>
					))}
				</div>
			) : allRatings.length > 0 ? (
				<div className="space-y-3">
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
									<span className="text-sm">Завантаження...</span>
								</div>
							) : (
								<div className="h-1 w-full" aria-hidden="true" />
							)}
						</div>
					)}
				</div>
			) : (
				<p className="text-center text-muted-foreground py-8 border rounded-lg">
					Поки що немає відгуків для цього курсу
				</p>
			)}
		</div>
	);
}
