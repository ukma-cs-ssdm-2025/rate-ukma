import { useMemo } from "react";

import { Badge } from "@/components/ui/Badge";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/Tooltip";
import { TermBadge } from "@/components/TermBadge";
import {
	getCurrentSemester,
	isFutureSemester,
} from "@/features/courses/courseFormatting";
import { CANNOT_RATE_TOOLTIP_TEXT } from "@/features/ratings/definitions/ratingDefinitions";
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
	const currentSemester = useMemo(() => getCurrentSemester(), []);

	const { year, seasonRaw } = seasonGroup;

	const isFuture =
		year != null &&
		seasonRaw != null &&
		isFutureSemester({ year, season: seasonRaw }, currentSemester);

	const allRated =
		seasonGroup.totalCount > 0 &&
		seasonGroup.ratedCount === seasonGroup.totalCount;
	const hasRateableCourses = seasonGroup.unratedRateableCount > 0;
	const hasUnratedButNotRateable = seasonGroup.items.some(
		(item) => !item.rated && !item.can_rate,
	);

	const sortedItems = useMemo(() => {
		// Rateable pending courses already render in MyRatingsPendingSection.
		return seasonGroup.items
			.filter((course) => course.rated || !course.can_rate)
			.sort((a, b) => {
				return (a.course_title ?? "").localeCompare(b.course_title ?? "");
			});
	}, [seasonGroup.items]);

	if (sortedItems.length === 0) return null;

	return (
		<section aria-label={seasonGroup.description} className="space-y-1">
			<div
				className="flex flex-wrap items-center gap-2 py-2"
				data-testid={testIds.myRatings.semesterTrigger}
			>
				{seasonRaw ? (
					<TermBadge term={seasonRaw}>{seasonGroup.label}</TermBadge>
				) : (
					<span className="font-medium text-foreground">
						{seasonGroup.label}
					</span>
				)}
				<span className="text-xs text-muted-foreground">
					{seasonGroup.ratedCount} з {seasonGroup.totalCount}
				</span>
				{hasRateableCourses && (
					<Badge variant="soft">
						Ще {seasonGroup.unratedRateableCount} оцінити
					</Badge>
				)}
				{allRated && <Badge variant="success">Все оцінено</Badge>}
				{!hasRateableCourses && hasUnratedButNotRateable && !isFuture && (
					<Tooltip>
						<TooltipTrigger asChild>
							<Badge variant="outline" className="cursor-help">
								Оцінювання невдовзі
							</Badge>
						</TooltipTrigger>
						<TooltipContent side="top">
							{CANNOT_RATE_TOOLTIP_TEXT}
						</TooltipContent>
					</Tooltip>
				)}
				{isFuture && <Badge variant="outline">Ще не розпочався</Badge>}
			</div>
			<div className="divide-y divide-border/30">
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
