import { cn } from "@/lib/utils";
import { getDifficultyTone, getUsefulnessTone } from "../courseFormatting";

interface CourseScoreCellProps {
	value?: number;
	variant: "difficulty" | "usefulness";
}

export function CourseScoreCell({
	value,
	variant,
}: Readonly<CourseScoreCellProps>) {
	if (!value) {
		return (
			<div className="flex items-center justify-center">
				<span className="font-medium tabular-nums text-muted-foreground">
					-
				</span>
			</div>
		);
	}

	const tone =
		variant === "difficulty"
			? getDifficultyTone(value)
			: getUsefulnessTone(value);

	return (
		<div className="flex items-center justify-center">
			<span
				className={cn(
					"font-semibold tabular-nums text-sm leading-tight sm:text-base md:text-lg",
					tone,
				)}
			>
				{value.toFixed(1)}
			</span>
		</div>
	);
}
