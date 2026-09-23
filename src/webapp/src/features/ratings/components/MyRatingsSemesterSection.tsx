import { useMemo } from "react";

import { TermBadge } from "@/components/TermBadge";
import type { SemesterGroup } from "@/features/ratings/groupRatings";
import { testIds } from "@/lib/test-ids";
import { MyRatingCard } from "./MyRatingCard";

interface MyRatingsSemesterSectionProps {
	seasonGroup: SemesterGroup;
	onRatingChanged: () => undefined | Promise<unknown>;
}

export function MyRatingsSemesterSection({
	seasonGroup,
	onRatingChanged,
}: Readonly<MyRatingsSemesterSectionProps>) {
	const sortedItems = useMemo(() => {
		return [...seasonGroup.items].sort((a, b) =>
			(a.course_title ?? "").localeCompare(b.course_title ?? ""),
		);
	}, [seasonGroup.items]);

	if (sortedItems.length === 0) return null;

	return (
		<section aria-label={seasonGroup.description} className="space-y-2">
			<div
				className="flex flex-wrap items-center gap-2 py-1"
				data-testid={testIds.myRatings.semesterTrigger}
			>
				{seasonGroup.seasonRaw ? (
					<TermBadge term={seasonGroup.seasonRaw}>
						{seasonGroup.label}
					</TermBadge>
				) : (
					<span className="font-medium text-foreground">
						{seasonGroup.label}
					</span>
				)}
				<span className="text-xs text-muted-foreground">
					{seasonGroup.ratedCount} з {seasonGroup.totalCount}
				</span>
			</div>
			<div className="space-y-1">
				{sortedItems.map((course, index) => (
					<MyRatingCard
						key={
							course.course_offering_id ??
							course.course_id ??
							`${seasonGroup.key}-${index}`
						}
						course={course}
						onRatingChanged={onRatingChanged}
					/>
				))}
			</div>
		</section>
	);
}
