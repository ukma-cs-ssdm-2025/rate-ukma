import { Skeleton } from "@/components/ui/Skeleton";
import { testIds } from "@/lib/test-ids";

const SKELETON_KEYS = ["skeleton-1", "skeleton-2", "skeleton-3"];

// Mirrors the feed card order: kind, title, text, time and action.
export function FeedSkeleton() {
	return (
		<div className="space-y-3" data-testid={testIds.feed.skeleton}>
			{SKELETON_KEYS.map((key) => (
				<div key={key} className="space-y-3 rounded-xl border bg-card p-5">
					<div className="flex items-center gap-2">
						<Skeleton className="size-6 rounded-full" />
						<Skeleton className="h-3 w-16" />
					</div>
					<Skeleton className="h-5 w-2/3" />
					<Skeleton className="h-4 w-full" />
					<div className="flex items-center justify-between pt-1">
						<Skeleton className="h-3 w-16" />
						<Skeleton className="h-8 w-32" />
					</div>
				</div>
			))}
		</div>
	);
}
