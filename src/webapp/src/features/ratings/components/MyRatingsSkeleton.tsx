import { Skeleton } from "@/components/ui/Skeleton";

const SKELETON_GROUPS = ["skeleton-group-1", "skeleton-group-2"];
const SKELETON_CARDS = ["skeleton-card-1", "skeleton-card-2"];

// Mirrors a semester group: its header row, then muted course cards.
export function MyRatingsSkeleton() {
	return (
		<div className="space-y-6" aria-hidden="true">
			{SKELETON_GROUPS.map((group) => (
				<div key={group} className="space-y-2">
					<div className="flex items-center gap-2 py-2">
						<Skeleton className="size-4" />
						<Skeleton className="h-5 w-28" />
					</div>
					{SKELETON_CARDS.map((card) => (
						<div
							key={card}
							className="flex items-center gap-6 rounded-xl bg-muted/50 px-4 py-3"
						>
							<div className="min-w-0 flex-1 space-y-2">
								<Skeleton className="h-5 w-1/3" />
								<Skeleton className="h-4 w-1/2" />
							</div>
							<Skeleton className="h-8 w-24" />
						</div>
					))}
				</div>
			))}
		</div>
	);
}
