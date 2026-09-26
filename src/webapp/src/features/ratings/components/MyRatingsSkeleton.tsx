import { Skeleton } from "@/components/ui/Skeleton";

const SKELETON_YEARS = ["skeleton-year-1", "skeleton-year-2"];
const SKELETON_ROWS = ["skeleton-row-1", "skeleton-row-2", "skeleton-row-3"];

export function MyRatingsSkeleton() {
	return (
		<div className="space-y-8">
			{SKELETON_YEARS.map((year) => (
				<div key={year} className="space-y-3">
					<Skeleton className="h-6 w-32" />
					<Skeleton className="h-5 w-24" />
					<div className="divide-y divide-border/30">
						{SKELETON_ROWS.map((row) => (
							<div key={row} className="flex items-center gap-3 py-3">
								<div className="flex-1 space-y-2">
									<Skeleton className="h-4 w-2/3" />
									<Skeleton className="h-3 w-1/3" />
								</div>
								<Skeleton className="h-8 w-24" />
							</div>
						))}
					</div>
				</div>
			))}
		</div>
	);
}
