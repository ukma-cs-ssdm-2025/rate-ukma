import { Skeleton } from "@/components/ui/Skeleton";

const SKELETON_KEYS = ["skeleton-1", "skeleton-2", "skeleton-3"];

export function MyRatingsSkeleton() {
	return (
		<div className="space-y-4">
			{SKELETON_KEYS.map((key) => (
				<div key={key} className="rounded-xl border p-6 space-y-4">
					<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
						<div className="space-y-2 w-full">
							<Skeleton className="h-5 w-48" />
							<Skeleton className="h-4 w-64" />
						</div>
						<Skeleton className="h-9 w-28" />
					</div>
					<div className="grid gap-4 md:grid-cols-3">
						<Skeleton className="h-20 rounded-lg" />
						<Skeleton className="h-20 rounded-lg" />
						<Skeleton className="h-20 rounded-lg" />
					</div>
					<Skeleton className="h-16 rounded-lg" />
				</div>
			))}
		</div>
	);
}
