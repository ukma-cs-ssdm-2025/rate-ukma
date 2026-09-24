import { Skeleton } from "@/components/ui/Skeleton";
import { testIds } from "@/lib/test-ids";

const SKELETON_KEYS = ["skeleton-1", "skeleton-2", "skeleton-3"];

// Mirrors the feed row order: title → scores → text → meta.
export function FeedSkeleton() {
	return (
		<div
			className="divide-y divide-border/60 border-y border-border/60"
			data-testid={testIds.feed.skeleton}
		>
			{SKELETON_KEYS.map((key) => (
				<div key={key} className="space-y-3 py-5">
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
