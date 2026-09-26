import { Skeleton } from "@/components/ui/Skeleton";
import { testIds } from "@/lib/test-ids";

const SKELETON_KEYS = ["skeleton-1", "skeleton-2", "skeleton-3"];

// Mirrors the feed card order: title → scores → text → meta.
export function FeedSkeleton() {
	return (
		<div className="space-y-3" data-testid={testIds.feed.skeleton}>
			{SKELETON_KEYS.map((key) => (
				<div key={key} className="space-y-3 rounded-xl border bg-card p-5">
					<Skeleton className="h-5 w-3/4" />
					<Skeleton className="h-4 w-40" />
					<Skeleton className="h-4 w-full" />
					<Skeleton className="h-4 w-2/3" />
					<div className="flex items-center gap-2">
						<Skeleton className="h-5 w-20 rounded-full" />
						<Skeleton className="h-3 w-24" />
					</div>
				</div>
			))}
		</div>
	);
}
