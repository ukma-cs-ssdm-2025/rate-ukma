import {
	getDifficultyTone,
	getUsefulnessTone,
} from "@/features/courses/courseFormatting";
import { cn } from "@/lib/utils";

interface RatingStatsProps {
	readonly difficulty: number | undefined;
	readonly usefulness: number | undefined;
}

export function RatingStats({ difficulty, usefulness }: RatingStatsProps) {
	const difficultyValue = difficulty?.toFixed(1) ?? "—";
	const usefulnessValue = usefulness?.toFixed(1) ?? "—";

	return (
		<div className="flex flex-wrap items-center justify-start gap-x-4 gap-y-1.5 sm:justify-end">
			<div className="flex items-center gap-1.5 text-sm leading-none">
				<span className="text-sm text-muted-foreground">Складність</span>
				<span
					className={cn(
						"text-sm font-semibold tabular-nums",
						getDifficultyTone(difficulty),
					)}
				>
					{difficultyValue}
				</span>
			</div>

			<div className="flex items-center gap-1.5 text-sm leading-none">
				<span className="text-sm text-muted-foreground">Корисність</span>
				<span
					className={cn(
						"text-sm font-semibold tabular-nums",
						getUsefulnessTone(usefulness),
					)}
				>
					{usefulnessValue}
				</span>
			</div>
		</div>
	);
}
