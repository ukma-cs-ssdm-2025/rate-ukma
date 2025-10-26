import { DataTableSkeleton } from "@/components/DataTable/DataTableSkeleton";
import { Skeleton } from "@/components/ui/Skeleton";

export function CoursesTableSkeleton() {
	return (
		<div className="space-y-4">
			<div className="flex items-center gap-4">
				<Skeleton className="h-12 w-full max-w-xl" />
				<Skeleton className="hidden h-12 w-32 md:flex" />
			</div>
			<DataTableSkeleton columnCount={4} withViewOptions={false} />
		</div>
	);
}
