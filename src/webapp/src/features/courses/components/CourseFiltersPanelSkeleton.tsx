import { Skeleton } from "@/components/ui/Skeleton";

export function CourseFiltersPanelSkeleton() {
	const placeholderSections = [
		"difficulty",
		"usefulness",
		"semesterYear",
		"semesterTerm",
		"eduLevel",
		"faculty",
		"department",
		"speciality",
	] as const;

	return (
		<div className="sticky top-6 space-y-6" aria-hidden="true">
			<div className="flex min-h-10 items-center justify-between gap-2">
				<Skeleton className="h-5 w-16" />
			</div>
			<div className="flex flex-wrap gap-2">
				<Skeleton className="h-8 w-24 rounded-md" />
				<Skeleton className="h-8 w-28 rounded-md" />
			</div>
			{placeholderSections.map((sectionKey) => (
				<div key={sectionKey} className="space-y-3">
					<Skeleton className="h-4 w-24" />
					<Skeleton className="h-9 w-full rounded-md" />
				</div>
			))}
			<div className="space-y-3">
				<Skeleton className="h-4 w-28" />
				<Skeleton className="h-9 w-full rounded-md" />
			</div>
		</div>
	);
}
