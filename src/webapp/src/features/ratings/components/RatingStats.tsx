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
		<div className="flex items-center gap-2 text-xs">
			<span className="text-muted-foreground">Складність:</span>
			<span
				className={cn(
					"font-semibold tabular-nums",
					getDifficultyTone(difficulty),
				)}
			>
				{difficultyValue}
			</span>
			<span className="text-muted-foreground/40">•</span>
			<span className="text-muted-foreground">Корисність:</span>
			<span
				className={cn(
					"font-semibold tabular-nums",
					getUsefulnessTone(usefulness),
				)}
			>
				{usefulnessValue}
			</span>
		</div>
	);
}
