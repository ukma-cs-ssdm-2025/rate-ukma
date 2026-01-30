import type { YearGroup } from "@/features/ratings/types";
import { MyRatingsSemesterSection } from "./MyRatingsSemesterSection";

interface MyRatingsYearSectionProps {
	yearGroup: YearGroup;
	onRatingChanged: () => undefined | Promise<unknown>;
	collapsedState: Record<string, boolean>;
	onToggle: (key: string, isOpen: boolean) => void;
}

export function MyRatingsYearSection({
	yearGroup,
	onRatingChanged,
	collapsedState,
	onToggle,
}: Readonly<MyRatingsYearSectionProps>) {
	return (
		<div className="space-y-3">
			<h2 className="text-xl font-semibold text-foreground">
				{yearGroup.label}
			</h2>

			<div className="space-y-1">
				{yearGroup.seasons.map((seasonGroup) => (
					<MyRatingsSemesterSection
						key={seasonGroup.key}
						seasonGroup={seasonGroup}
						onRatingChanged={onRatingChanged}
						isOpen={collapsedState[seasonGroup.key]}
						onToggle={(open) => onToggle(seasonGroup.key, open)}
					/>
				))}
			</div>
		</div>
	);
}
