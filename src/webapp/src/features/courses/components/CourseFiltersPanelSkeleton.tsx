import { Separator } from "@/components/ui/Separator";
import { Skeleton } from "@/components/ui/Skeleton";

function FieldSkeleton({ control }: Readonly<{ control: string }>) {
	return (
		<div className="space-y-2">
			<Skeleton className="h-4 w-24" />
			<Skeleton className={control} />
		</div>
	);
}

function SliderSkeleton() {
	return (
		<div className="space-y-2">
			<div className="flex items-center justify-between">
				<Skeleton className="h-4 w-24" />
				<Skeleton className="h-4 w-10" />
			</div>
			<Skeleton className="my-2 h-1.5 w-full rounded-full" />
		</div>
	);
}

// Mirrors CourseFiltersContent: speciality and type, semester, scores,
// then faculty, department, level and instructor.
export function CourseFiltersPanelSkeleton() {
	return (
		<div className="sticky top-22 space-y-6" aria-hidden="true">
			<div className="flex min-h-10 items-center">
				<Skeleton className="h-5 w-16" />
			</div>
			<div className="space-y-4">
				<div className="space-y-1.5">
					<FieldSkeleton control="h-9 w-full" />
					<Skeleton className="h-3 w-44" />
				</div>
				<FieldSkeleton control="h-11 w-full" />
			</div>
			<Separator />
			<div className="space-y-4">
				<FieldSkeleton control="h-9 w-full" />
				<FieldSkeleton control="h-9 w-full" />
				<SliderSkeleton />
			</div>
			<div className="space-y-4">
				<SliderSkeleton />
				<SliderSkeleton />
			</div>
			<Separator />
			<div className="space-y-4">
				<FieldSkeleton control="h-9 w-full" />
				<FieldSkeleton control="h-9 w-full" />
				<FieldSkeleton control="h-9 w-full" />
				<FieldSkeleton control="h-9 w-full" />
			</div>
		</div>
	);
}
