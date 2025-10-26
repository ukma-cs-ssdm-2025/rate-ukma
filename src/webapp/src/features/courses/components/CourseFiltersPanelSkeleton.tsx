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

	const badgePlaceholders = ["one", "two", "three"] as const;

	return (
		<Card className="sticky top-6">
			<CardHeader className="pb-4">
				<CardTitle className="flex items-center gap-2">
					<Skeleton className="h-5 w-5 rounded-full" />
					<Skeleton className="h-5 w-28" />
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-6">
				{placeholderSections.map((sectionKey) => (
					<div key={sectionKey} className="space-y-3">
						<Skeleton className="h-4 w-32" />
						<Skeleton className="h-3 w-full" />
						<Skeleton className="h-3 w-full" />
					</div>
				))}
				<div className="space-y-2 border-t pt-4">
					<Skeleton className="h-4 w-24" />
					<div className="flex flex-wrap gap-2">
						{badgePlaceholders.map((badgeKey) => (
							<Skeleton key={badgeKey} className="h-5 w-20 rounded-full" />
						))}
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
