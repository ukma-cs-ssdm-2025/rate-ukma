import { SectionHeader } from "@/components/SectionHeader";
import type { YearGroup } from "@/features/ratings/groupRatings";
import { MyRatingsSemesterSection } from "./MyRatingsSemesterSection";

interface MyRatingsYearSectionProps {
	yearGroup: YearGroup;
	onRatingChanged: () => undefined | Promise<unknown>;
	forceOpen?: boolean;
}

export function MyRatingsYearSection({
	yearGroup,
	onRatingChanged,
	forceOpen,
}: Readonly<MyRatingsYearSectionProps>) {
	if (yearGroup.seasons.length === 0) return null;

	// An academic-year heading over a single semester is noise, and so is one
	// over a filtered list, so those semesters stand alone as "Весна 2026".
	if (
		(forceOpen || yearGroup.seasons.length === 1) &&
		yearGroup.seasons.every((season) => season.year != null)
	) {
		return (
			<>
				{yearGroup.seasons.map((seasonGroup) => (
					<MyRatingsSemesterSection
						key={seasonGroup.key}
						seasonGroup={{
							...seasonGroup,
							label: `${seasonGroup.label} ${seasonGroup.year}`,
						}}
						onRatingChanged={onRatingChanged}
						forceOpen={forceOpen}
					/>
				))}
			</>
		);
	}

	return (
		<div className="space-y-3">
			<SectionHeader title={yearGroup.label} />

			<div className="space-y-0.5">
				{yearGroup.seasons.map((seasonGroup) => (
					<MyRatingsSemesterSection
						key={seasonGroup.key}
						seasonGroup={seasonGroup}
						onRatingChanged={onRatingChanged}
						forceOpen={forceOpen}
					/>
				))}
			</div>
		</div>
	);
}
