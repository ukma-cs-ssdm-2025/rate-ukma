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
	if (yearGroup.seasons.length === 0) return null;

	// An academic-year heading over a single semester is noise, so a lone
	// semester stands on its own as "Весна 2026".
	const [onlySeason] = yearGroup.seasons;
	if (yearGroup.seasons.length === 1 && onlySeason.year != null) {
		return (
			<MyRatingsSemesterSection
				seasonGroup={{
					...onlySeason,
					label: `${onlySeason.label} ${onlySeason.year}`,
				}}
				onRatingChanged={onRatingChanged}
			/>
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
					/>
				))}
			</div>
		</div>
	);
}
