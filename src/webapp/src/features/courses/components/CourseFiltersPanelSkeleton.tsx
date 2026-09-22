import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";

export function CourseFiltersPanelSkeleton() {
	const placeholderSections = [
		"difficulty",
		"usefulness",
		"semesterTerm",
		"semesterYear",
		"faculty",
		"department",
		"speciality",
		"courseType",
		"instructor",
	] as const;

	return (
		<Card className="sticky top-6">
			<CardHeader className="pb-4">
				<CardTitle className="flex items-center gap-2 text-base font-semibold">
					<Skeleton className="h-4 w-4 rounded-md" />
					<Skeleton className="h-5 w-28" />
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-6">
				<div className="flex flex-wrap gap-2">
					<Skeleton className="h-8 w-24 rounded-md" />
					<Skeleton className="h-8 w-28 rounded-md" />
				</div>
				{placeholderSections.map((sectionKey) => (
					<div key={sectionKey} className="space-y-3">
						<Skeleton className="h-4 w-32" />
						<Skeleton className="h-9 w-full rounded-md" />
					</div>
				))}
			</CardContent>
		</Card>
	);
}
