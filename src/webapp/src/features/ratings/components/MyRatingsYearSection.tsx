import { SectionHeader } from "@/components/SectionHeader";
import type { YearGroup } from "@/features/ratings/groupRatings";
import { MyRatingsSemesterSection } from "./MyRatingsSemesterSection";

interface MyRatingsYearSectionProps {
	yearGroup: YearGroup;
	onRatingChanged: () => undefined | Promise<unknown>;
}

export function MyRatingsYearSection({
	yearGroup,
	onRatingChanged,
}: Readonly<MyRatingsYearSectionProps>) {
	const visibleSeasons = yearGroup.seasons.filter((seasonGroup) =>
		seasonGroup.items.some((course) => course.rated || !course.can_rate),
	);
	if (visibleSeasons.length === 0) return null;

	return (
		<div className="space-y-3">
			<SectionHeader title={yearGroup.label} />

			<div className="space-y-6">
				{visibleSeasons.map((seasonGroup) => (
					<MyRatingsSemesterSection
						key={seasonGroup.key}
						seasonGroup={seasonGroup}
						onRatingChanged={onRatingChanged}
					/>
				))}
			</div>
		</div>
	);
}
